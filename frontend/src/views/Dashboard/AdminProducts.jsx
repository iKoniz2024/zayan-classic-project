"use client";

import { compressImage } from "@/utils/compressImage";
import Link from 'next/link';
import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { Plus, Eye, Trash2, X, Package, Camera, ImagePlus, Search, ChevronLeft, ChevronRight } from "lucide-react";

import { getProducts, createProduct, deleteProduct } from "@/services/product.api";
import { formatBDT } from "@/utils/currency";
import { getCategories } from "@/services/category.api";
import { Button } from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Helmet } from "react-helmet-async";
import useSettings from "@/hooks/useSettings";

const AVAILABLE_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];

const MEASUREMENT_PRESETS = {
  tops: {
    label: "Shirt / Panjabi / Polo / T-Shirt",
    fields: [
      { key: "chest", label: "Chest (বুক)", placeholder: "e.g. 38" },
      { key: "long", label: "Length / Long (দৈর্ঘ্য)", placeholder: "e.g. 28" },
      { key: "shoulder", label: "Shoulder (কাধ)", placeholder: "e.g. 17" },
      { key: "sleeve", label: "Sleeve (হাতা)", placeholder: "e.g. 24" },
    ],
  },
  bottoms: {
    label: "Pant / Pajama / Trouser",
    fields: [
      { key: "waist", label: "Waist (কোমর)", placeholder: "e.g. 32" },
      { key: "long", label: "Length / Long (দৈর্ঘ্য)", placeholder: "e.g. 40" },
      { key: "hip", label: "Hip (হিপ)", placeholder: "e.g. 42" },
      { key: "thigh", label: "Thigh (রান)", placeholder: "e.g. 24" },
    ],
  },
  baby: {
    label: "Baby Wear / Kids",
    fields: [
      { key: "chest", label: "Chest (বুক)", placeholder: "e.g. 24" },
      { key: "long", label: "Length (দৈর্ঘ্য)", placeholder: "e.g. 20" },
      { key: "ageGroup", label: "Age Group (বয়স)", placeholder: "e.g. 2-3 Years" },
    ],
  },
  shoes: {
    label: "Shoes / Footwear",
    fields: [
      { key: "footLength", label: "Foot Length (পায়ের দৈর্ঘ্য)", placeholder: "e.g. 26 cm" },
      { key: "euSize", label: "EU/UK Size", placeholder: "e.g. EU 41" },
    ],
  },
  standard: {
    label: "Standard / Custom (Long & Body)",
    fields: [
      { key: "long", label: "Long (দৈর্ঘ্য)", placeholder: "e.g. 28" },
      { key: "body", label: "Body (বুক)", placeholder: "e.g. 38" },
    ],
  },
};

const productSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  category: z.string().min(1, "Category is required"),
  price: z.coerce.number().positive("Price must be greater than 0"),
  discountPercentage: z.coerce.number().min(0).max(100).optional().default(0),
  stock: z.coerce.number().min(0, "Stock cannot be negative"),
  brand: z.string().optional().default(""),
  tags: z.string().optional().default(""),
  warrantyInformation: z.string().optional().default(""),
  shippingInformation: z.string().optional().default(""),
  returnPolicy: z.string().optional().default(""),
});

function ProductSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}

function getAllCategorySlugs(categories) {
  const slugs = [];
  for (const parent of categories) {
    if (parent.slug) slugs.push(parent.slug);
    for (const child of parent.children ?? []) {
      if (child.slug) slugs.push(child.slug);
    }
  }
  return [...new Set(slugs)];
}

import usePageTitle from "@/hooks/usePageTitle";

export default function AdminProducts({ children }) {
  const { siteName } = useSettings();
  usePageTitle("Admin Products");
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [imagePreviews, setImagePreviews] = useState([]);
  const [thumbnailDrag, setThumbnailDrag] = useState(false);
  const [imagesDrag, setImagesDrag] = useState(false);
  const thumbnailInputRef = useRef(null);
  const imagesInputRef = useRef(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [discountFilter, setDiscountFilter] = useState("");
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [sizeMeasurements, setSizeMeasurements] = useState({});
  const [measurementPreset, setMeasurementPreset] = useState("tops");
  const [colorVariants, setColorVariants] = useState([]);
  const [colorNameInput, setColorNameInput] = useState("");
  const [colorFile, setColorFile] = useState(null);
  const [colorPreview, setColorPreview] = useState("");
  const colorInputRef = useRef(null);
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: getProducts,
    staleTime: 5 * 60 * 1000,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
    staleTime: 5 * 60 * 1000,
  });

  const categories = categoriesData ?? [];
  const categorySlugs = getAllCategorySlugs(categories);

  const products = useMemo(() => data?.products ?? [], [data]);

  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchesSearch =
      product.title.toLowerCase().includes(search.toLowerCase()) ||
      product.brand?.toLowerCase().includes(search.toLowerCase()) ||
      product.category?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !categoryFilter || product.category === categoryFilter;
    const matchesStock =
      stockFilter === "" ||
      (stockFilter === "in-stock" && product.stock > 10) ||
      (stockFilter === "low-stock" && product.stock > 0 && product.stock <= 10) ||
      (stockFilter === "out-of-stock" && product.stock === 0);
    const matchesDiscount =
      discountFilter === "" ||
      (discountFilter === "with-discount" && product.discountPercentage > 0) ||
      (discountFilter === "no-discount" && product.discountPercentage === 0);
    return matchesSearch && matchesCategory && matchesStock && matchesDiscount;
  }), [products, search, categoryFilter, stockFilter, discountFilter]);

  const totalPages = Math.ceil(filteredProducts.length / limit);
  const paginatedProducts = filteredProducts.slice((page - 1) * limit, page * limit);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setError,
  } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      price: 0,
      discountPercentage: 0,
      stock: 0,
      brand: "",
      tags: "",
      warrantyInformation: "",
      shippingInformation: "",
      returnPolicy: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: (res, variables) => {
      toast.success("Product created successfully");
      queryClient.setQueryData(["admin-products"], (old) => {
        if (!old) return old;
        const newProduct = {
          _id: res?.insertedId || res?._id || Date.now().toString(),
          ...variables,
        };
        return {
          ...old,
          products: [newProduct, ...(old.products || [])],
          totalProducts: (old.totalProducts || 0) + 1,
        };
      });
      queryClient.invalidateQueries();
      setShowForm(false);
      resetForm();
    },
    onError: (err) => {
      const data = err?.response?.data;
      if (data?.errors && Array.isArray(data.errors)) {
        data.errors.forEach((e) => {
          const field = e.path?.[e.path.length - 1];
          if (field) setError(field, { message: e.message });
        });
        toast.error("Please fix the errors below");
      } else {
        toast.error(data?.message || data?.error || "Failed to create product");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["admin-products"] });
      const previous = queryClient.getQueryData(["admin-products"]);
      queryClient.setQueryData(["admin-products"], (old) => {
        if (!old || !old.products) return old;
        return {
          ...old,
          products: old.products.filter((p) => p._id !== id),
          totalProducts: Math.max(0, (old.totalProducts || 0) - 1),
        };
      });
      return { previous };
    },
    onError: (err, id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["admin-products"], context.previous);
      }
      toast.error(err?.response?.data?.message || "Failed to delete product");
    },
    onSuccess: () => {
      toast.success("Product deleted successfully");
      setDeletingId(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries();
    },
  });



  const toBase64 = (file) => compressImage(file);

  const resetForm = () => {
    setThumbnailFile(null);
    setImageFiles([]);
    setThumbnailPreview("");
    setImagePreviews([]);
    setSelectedSizes([]);
    setSizeMeasurements({});
    setMeasurementPreset("tops");
    setColorVariants([]);
    setColorNameInput("");
    setColorFile(null);
    setColorPreview("");
    reset();
  };

  const handleAddColorVariant = async () => {
    if (!colorNameInput.trim()) {
      toast.error("Please enter a color name");
      return;
    }
    if (!colorFile && !colorPreview) {
      toast.error("Please upload an image for this color");
      return;
    }
    let imgStr = colorPreview;
    if (colorFile) {
      imgStr = await toBase64(colorFile);
    }
    setColorVariants((prev) => [...prev, { name: colorNameInput.trim(), image: imgStr }]);
    setColorNameInput("");
    setColorFile(null);
    setColorPreview("");
  };

  const handleRemoveColorVariant = (index) => {
    setColorVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (formData) => {
    const activeFields = MEASUREMENT_PRESETS[measurementPreset]?.fields || [];
    if (selectedSizes.length > 0) {
      for (const size of selectedSizes) {
        const m = sizeMeasurements[size];
        const hasAnyValue = activeFields.some((f) => m?.[f.key]?.toString().trim());
        if (!hasAnyValue) {
          toast.error(`Please provide measurements for size ${size}`);
          return;
        }
      }
    }

    let thumbnail = "";
    let images = [];

    if (thumbnailFile) {
      thumbnail = await toBase64(thumbnailFile);
    }

    if (imageFiles.length > 0) {
      images = await Promise.all(imageFiles.map((f) => toBase64(f)));
    }

    const processedColors = await Promise.all(
      colorVariants.map(async (c) => ({
        name: c.name,
        image: c.file ? await toBase64(c.file) : c.image,
      }))
    );

    if (!thumbnail && processedColors.length > 0) {
      thumbnail = processedColors[0].image;
    } else if (!thumbnail && images.length > 0) {
      thumbnail = images[0];
    }

    const payload = {
      ...formData,
      tags: formData.tags ? formData.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      sizes: selectedSizes,
      sizeMeasurements: (selectedSizes || []).map((s) => {
        const mData = sizeMeasurements[s] || {};
        const measurementObj = { size: s };
        activeFields.forEach((f) => {
          if (mData[f.key] !== undefined && mData[f.key] !== "") {
            measurementObj[f.key] = mData[f.key];
          }
        });
        return measurementObj;
      }),
      colors: processedColors,
      thumbnail,
      images,
    };
    createMutation.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <Helmet>
        <title>{`Admin Products | ${siteName}`}</title>
      </Helmet>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Products ({filteredProducts.length})</h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="size-4" data-icon="inline-start" />
          Add Product
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border bg-card p-4 shadow-sm"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            >
              <option value="">All Categories</option>
              {categorySlugs.map((slug) => (
                <option key={slug} value={slug}>{slug}</option>
              ))}
            </select>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            >
              <option value="">All Stock</option>
              <option value="in-stock">In Stock (&gt;10)</option>
              <option value="low-stock">Low Stock (1-10)</option>
              <option value="out-of-stock">Out of Stock</option>
            </select>
            <select
              value={discountFilter}
              onChange={(e) => setDiscountFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            >
              <option value="">All Discounts</option>
              <option value="with-discount">With Discount</option>
              <option value="no-discount">No Discount</option>
            </select>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowForm(false)}
                className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background"
              >
                <X className="size-4" />
              </button>

              <h2 className="mb-6 text-lg font-semibold text-foreground">Add New Product</h2>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-foreground">Title *</label>
                    <Input {...register("title")} placeholder="Product title" className={errors.title ? "border-destructive" : ""} />
                    {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title.message}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-foreground">Description *</label>
                    <textarea
                      {...register("description")}
                      rows={3}
                      placeholder="Product description"
                      className={`w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring ${errors.description ? "border-destructive" : ""}`}
                    />
                    {errors.description && <p className="mt-1 text-xs text-destructive">{errors.description.message}</p>}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Category *</label>
                    <select
                      {...register("category")}
                      className={`w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring ${errors.category ? "border-destructive" : ""}`}
                    >
                      <option value="">Select category</option>
                      {categorySlugs.map((slug) => (
                        <option key={slug} value={slug}>{slug}</option>
                      ))}
                    </select>
                    {errors.category && <p className="mt-1 text-xs text-destructive">{errors.category.message}</p>}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Brand</label>
                    <Input {...register("brand")} placeholder="Brand name" />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-foreground">Available Sizes (for fashion products)</label>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {AVAILABLE_SIZES.map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => {
                            setSelectedSizes((prev) =>
                              prev.includes(size)
                                ? prev.filter((s) => s !== size)
                                : [...prev, size]
                            );
                          }}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${selectedSizes.includes(size)
                              ? "border-foreground bg-foreground text-background"
                              : "border-border bg-background text-foreground hover:border-muted-foreground"
                            }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                    {selectedSizes.length > 0 && (
                      <div className="space-y-4 rounded-lg border border-border p-4 bg-muted/30">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-3">
                          <label className="block text-sm font-bold text-foreground">Size Measurements (Inches)</label>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-muted-foreground">Type:</span>
                            <select
                              value={measurementPreset}
                              onChange={(e) => setMeasurementPreset(e.target.value)}
                              className="rounded-md border border-border bg-background px-2.5 py-1 text-xs outline-none focus:border-ring font-medium"
                            >
                              {Object.entries(MEASUREMENT_PRESETS).map(([key, preset]) => (
                                <option key={key} value={key}>
                                  {preset.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {selectedSizes.map((size) => {
                          const activeFields = MEASUREMENT_PRESETS[measurementPreset]?.fields || [];
                          return (
                            <div key={size} className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background p-3">
                              <div className="w-12 font-bold text-xs bg-foreground text-background text-center py-1 rounded">{size}</div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                                {activeFields.map((f) => (
                                  <div key={f.key} className="space-y-1">
                                    <label className="text-[11px] font-medium text-muted-foreground block">{f.label}</label>
                                    <Input
                                      placeholder={f.placeholder}
                                      value={sizeMeasurements[size]?.[f.key] || ""}
                                      onChange={(e) =>
                                        setSizeMeasurements((prev) => ({
                                          ...prev,
                                          [size]: { ...prev[size], [f.key]: e.target.value },
                                        }))
                                      }
                                      className="h-8 text-xs"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-2 space-y-3 rounded-lg border border-border p-4 bg-muted/20">
                    <label className="block text-sm font-medium text-foreground">Color Variants (Color Family with Image)</label>
                    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                      <Input
                        placeholder="Color name (e.g. Orange, Navy Blue)"
                        value={colorNameInput}
                        onChange={(e) => setColorNameInput(e.target.value)}
                        className="flex-1"
                      />
                      <input
                        type="file"
                        accept="image/*"
                        ref={colorInputRef}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setColorFile(file);
                            setColorPreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => colorInputRef.current?.click()}
                        className="shrink-0 text-xs"
                      >
                        <Camera className="size-3.5 mr-1" />
                        {colorPreview ? "Change Image" : "Upload Color Image"}
                      </Button>
                      <Button
                        type="button"
                        onClick={handleAddColorVariant}
                        className="shrink-0 text-xs"
                      >
                        Add Variant
                      </Button>
                    </div>
                    {colorPreview && (
                      <div className="flex items-center gap-2 pt-1">
                        <img src={colorPreview} alt="Color preview" className="size-10 rounded border object-cover" />
                        <span className="text-xs text-muted-foreground">Image selected for {colorNameInput || "new color"}</span>
                      </div>
                    )}

                    {colorVariants.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-3 pt-2 border-t border-border">
                        {colorVariants.map((c, index) => (
                          <div key={index} className="flex items-center gap-2 rounded-lg border border-border bg-background p-1.5 pr-3 shadow-sm">
                            <img src={c.image} alt={c.name} className="size-9 rounded object-cover border" />
                            <span className="text-xs font-semibold text-foreground">{c.name}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveColorVariant(index)}
                              className="ml-1 text-muted-foreground hover:text-destructive"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Price in BDT *</label>
                    <Input {...register("price")} type="number" step="0.01" placeholder="৳0" className={errors.price ? "border-destructive" : ""} />
                    {errors.price && <p className="mt-1 text-xs text-destructive">{errors.price.message}</p>}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Discount %</label>
                    <Input {...register("discountPercentage")} type="number" step="0.1" min="0" max="100" placeholder="0" />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Stock *</label>
                    <Input {...register("stock")} type="number" min="0" placeholder="0" className={errors.stock ? "border-destructive" : ""} />
                    {errors.stock && <p className="mt-1 text-xs text-destructive">{errors.stock.message}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-foreground">Tags (comma separated)</label>
                    <Input {...register("tags")} placeholder="e.g. wireless, bluetooth, headphones" />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-foreground">Thumbnail</label>
                    <input
                      ref={thumbnailInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setThumbnailFile(file);
                          setThumbnailPreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                    <div
                      onClick={() => thumbnailInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setThumbnailDrag(true); }}
                      onDragLeave={() => setThumbnailDrag(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setThumbnailDrag(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file && file.type.startsWith("image/")) {
                          setThumbnailFile(file);
                          setThumbnailPreview(URL.createObjectURL(file));
                        }
                      }}
                      className={`cursor-pointer rounded-xl border-2 border-dashed p-5 transition-all duration-200 hover:border-primary/50 hover:bg-primary/5 ${thumbnailDrag ? "border-primary bg-primary/10 scale-[1.01]" : "border-border"}`}
                    >
                      {thumbnailPreview ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="relative">
                            <img src={thumbnailPreview} alt="Thumbnail" className="size-20 rounded-xl object-cover ring-2 ring-border" />
                            <div className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Camera className="size-3" />
                            </div>
                          </div>
                          <div className="text-sm font-medium text-foreground">Change thumbnail</div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3 py-4">
                          <div className={`flex size-16 items-center justify-center rounded-xl transition-colors ${thumbnailDrag ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                            <Camera className="size-7" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium text-foreground">Click to upload thumbnail</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">Any image format up to 5MB</p>
                            <p className="mt-1.5 text-xs text-primary">or drag & drop</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-foreground">Images</label>
                    <input
                      ref={imagesInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        setImageFiles((prev) => [...prev, ...files]);
                        setImagePreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
                        e.target.value = "";
                      }}
                    />
                    <div
                      onClick={() => imagesInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setImagesDrag(true); }}
                      onDragLeave={() => setImagesDrag(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setImagesDrag(false);
                        const files = Array.from(e.dataTransfer.files ?? []).filter((f) => f.type.startsWith("image/"));
                        if (files.length > 0) {
                          setImageFiles((prev) => [...prev, ...files]);
                          setImagePreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
                        }
                      }}
                      className={`cursor-pointer rounded-xl border-2 border-dashed p-5 transition-all duration-200 hover:border-primary/50 hover:bg-primary/5 ${imagesDrag ? "border-primary bg-primary/10 scale-[1.01]" : "border-border"}`}
                    >
                      {imagePreviews.length > 0 ? (
                        <div className="flex flex-wrap gap-3">
                          {imagePreviews.map((src, i) => (
                            <div key={i} className="relative">
                              <img src={src} alt="" className="size-20 rounded-xl object-cover ring-2 ring-border" />
                              <div className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <span className="text-[10px] font-bold">{i + 1}</span>
                              </div>
                            </div>
                          ))}
                          <div className="flex size-20 items-center justify-center rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 text-primary transition-colors hover:bg-primary/10">
                            <Plus className="size-6" />
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3 py-4">
                          <div className={`flex size-16 items-center justify-center rounded-xl transition-colors ${imagesDrag ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                            <ImagePlus className="size-7" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium text-foreground">Click to upload images</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">Any image format — multiple files supported</p>
                            <p className="mt-1.5 text-xs text-primary">or drag & drop</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Warranty</label>
                    <Input {...register("warrantyInformation")} placeholder="e.g. 1 year warranty" />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Shipping</label>
                    <Input {...register("shippingInformation")} placeholder="e.g. Free shipping" />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-foreground">Return Policy</label>
                    <Input {...register("returnPolicy")} placeholder="e.g. 30 day returns" />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={createMutation.isPending} className="rounded-lg">
                    {createMutation.isPending ? "Creating..." : "Create Product"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => { setShowForm(false); resetForm(); }}>
                    Cancel
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border bg-card shadow-sm"
      >
        {isLoading ? (
          <div className="p-5"><ProductSkeleton /></div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center">
            <Package className="mx-auto size-12 text-muted-foreground/30" />
            <p className="mt-3 text-sm text-muted-foreground">
              {products.length === 0 ? "No products yet." : "No products match your filters."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Price</th>
                  <th className="px-5 py-3 font-medium">Stock</th>
                  <th className="px-5 py-3 font-medium">Discount</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedProducts.map((product) => (
                  <tr key={product._id} className="hover:bg-muted/30">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={product.thumbnail || product.images?.[0] || undefined}
                          alt={product.title}
                          className="size-10 shrink-0 rounded-lg object-cover"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{product.title}</p>
                          {product.brand && <p className="truncate text-[11px] text-muted-foreground">{product.brand}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant="secondary" className="text-[11px]">{product.category}</Badge>
                    </td>
                    <td className="px-5 py-3 font-medium text-foreground">{formatBDT(product.price)}</td>
                    <td className="px-5 py-3">
                      <span className={`font-medium ${product.stock <= 10 ? "text-foreground" : "text-foreground"}`}>
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {product.discountPercentage > 0 ? (
                        <Badge variant="secondary" className="text-[11px]">{product.discountPercentage}%</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/dashboard/products/${product._id}`}>
                            <Eye className="size-4" />
                          </Link>
                        </Button>
                        {deletingId === product._id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={deleteMutation.isPending}
                              onClick={() => deleteMutation.mutate(product._id)}
                              className="h-7 text-xs px-2"
                            >
                              {deleteMutation.isPending ? "..." : "Delete"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingId(null)}
                              className="h-7 text-xs px-2"
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeletingId(product._id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-5 py-3">
                <p className="text-sm text-muted-foreground">
                  Showing {((page - 1) * limit) + 1}-{Math.min(page * limit, filteredProducts.length)} of {filteredProducts.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
