"use client";

import { useRouter, useParams } from 'next/navigation';
import { useState, useRef } from "react";
import { compressImage } from "@/utils/compressImage";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { ArrowLeft, Save, Trash2, Camera, X } from "lucide-react";
import { Helmet } from "react-helmet-async";
import useSettings from "@/hooks/useSettings";
import { getProductById, updateProduct, deleteProduct } from "@/services/product.api";
import { getCategories } from "@/services/category.api";
import { Button } from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/skeleton";

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

function detectPreset(sizeMeasurementsArray) {
  if (!sizeMeasurementsArray || sizeMeasurementsArray.length === 0) return "tops";
  const allKeys = new Set();
  sizeMeasurementsArray.forEach((m) => {
    Object.keys(m || {}).forEach((k) => {
      if (k !== "size" && k !== "_id") allKeys.add(k);
    });
  });
  if (allKeys.has("waist") || allKeys.has("hip") || allKeys.has("thigh")) return "bottoms";
  if (allKeys.has("footLength") || allKeys.has("euSize")) return "shoes";
  if (allKeys.has("ageGroup")) return "baby";
  if (allKeys.has("chest") || allKeys.has("shoulder") || allKeys.has("sleeve")) return "tops";
  return "standard";
}

const updateSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").optional(),
  description: z.string().min(10, "Description must be at least 10 characters").optional(),
  category: z.string().optional(),
  price: z.coerce.number().positive("Price must be greater than 0").optional(),
  discountPercentage: z.coerce.number().min(0).max(100).optional(),
  stock: z.coerce.number().min(0).optional(),
  tags: z.string().optional(),
  brand: z.string().optional(),
  weight: z.coerce.number().optional(),
  warrantyInformation: z.string().optional(),
  shippingInformation: z.string().optional(),
  returnPolicy: z.string().optional(),
  minimumOrderQuantity: z.coerce.number().min(1).optional(),
});

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

export default function AdminProductDetails({ children }) {
  const { siteName } = useSettings();
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [imagePreviews, setImagePreviews] = useState([]);
  const [thumbnailDrag, setThumbnailDrag] = useState(false);
  const [imagesDrag, setImagesDrag] = useState(false);
  const thumbnailInputRef = useRef(null);
  const imagesInputRef = useRef(null);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [sizeMeasurements, setSizeMeasurements] = useState({});
  const [measurementPreset, setMeasurementPreset] = useState("tops");
  const [colorVariants, setColorVariants] = useState([]);
  const [colorNameInput, setColorNameInput] = useState("");
  const [colorFile, setColorFile] = useState(null);
  const [colorPreview, setColorPreview] = useState("");
  const colorInputRef = useRef(null);

  const { data: product, isLoading } = useQuery({
    queryKey: ["admin-product", id],
    queryFn: () => getProductById(id),
    enabled: !!id,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const categories = categoriesData ?? [];
  const categorySlugs = getAllCategorySlugs(categories);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    setError,
  } = useForm({
    resolver: zodResolver(updateSchema),
    values: product
      ? {
        title: product.title ?? "",
        description: product.description ?? "",
        category: product.category ?? "",
        price: product.price ?? 0,
        discountPercentage: product.discountPercentage ?? 0,
        stock: product.stock ?? 0,
        tags: product.tags?.join(", ") ?? "",
        brand: product.brand ?? "",
        weight: product.weight ?? "",
        warrantyInformation: product.warrantyInformation ?? "",
        shippingInformation: product.shippingInformation ?? "",
        returnPolicy: product.returnPolicy ?? "",
        minimumOrderQuantity: product.minimumOrderQuantity ?? 1,
      }
      : undefined,
  });

  // Sync sizes, measurements, colors, and form when product changes (render-time pattern)
  const [prevProductId, setPrevProductId] = useState(null);
  if (product && product._id !== prevProductId) {
    setPrevProductId(product._id);
    setSelectedSizes(product.sizes ?? []);
    setColorVariants(product.colors ?? []);
    if (product.sizeMeasurements) {
      const initialMeasurements = {};
      product.sizeMeasurements.forEach(m => {
        const { size, _id, ...rest } = m;
        initialMeasurements[size] = rest;
      });
      setSizeMeasurements(initialMeasurements);
      setMeasurementPreset(detectPreset(product.sizeMeasurements));
    } else {
      setSizeMeasurements({});
      setMeasurementPreset("tops");
    }
    reset({
      title: product.title ?? "",
      description: product.description ?? "",
      category: product.category ?? "",
      price: product.price ?? 0,
      discountPercentage: product.discountPercentage ?? 0,
      stock: product.stock ?? 0,
      tags: product.tags?.join(", ") ?? "",
      brand: product.brand ?? "",
      weight: product.weight ?? "",
      warrantyInformation: product.warrantyInformation ?? "",
      shippingInformation: product.shippingInformation ?? "",
      returnPolicy: product.returnPolicy ?? "",
      minimumOrderQuantity: product.minimumOrderQuantity ?? 1,
    });
  }

  const updateMutation = useMutation({
    mutationFn: (payload) => updateProduct(id, payload),
    onSuccess: (res, variables) => {
      toast.success("Product updated");
      queryClient.setQueryData(["admin-product", id], (old) => ({
        ...old,
        ...variables,
      }));
      queryClient.setQueryData(["admin-products"], (old) => {
        if (!old || !old.products) return old;
        return {
          ...old,
          products: old.products.map((p) =>
            p._id === id ? { ...p, ...variables } : p
          ),
        };
      });
      queryClient.invalidateQueries({ queryKey: ["admin-product", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
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
        toast.error(data?.message || data?.error || "Failed to update product");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: ["admin-products"] });
      const previousProducts = queryClient.getQueryData(["admin-products"]);
      queryClient.setQueryData(["admin-products"], (old) => {
        if (!old || !old.products) return old;
        return {
          ...old,
          products: old.products.filter((p) => p._id !== deletedId),
          totalProducts: Math.max(0, (old.totalProducts || 0) - 1),
        };
      });
      return { previousProducts };
    },
    onError: (err, deletedId, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(["admin-products"], context.previousProducts);
      }
      toast.error(err?.response?.data?.message || "Failed to delete product");
    },
    onSuccess: () => {
      toast.success("Product deleted");
      router.push("/dashboard/products");
    },
    onSettled: () => {
      queryClient.invalidateQueries();
    },
  });



  const toBase64 = (file) => compressImage(file);

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

    let thumbnail = product.thumbnail ?? "";
    let images = product.images ?? [];

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
      title: formData.title,
      description: formData.description,
      category: formData.category,
      price: formData.price,
      discountPercentage: formData.discountPercentage,
      stock: formData.stock,
      brand: formData.brand,
      weight: formData.weight || undefined,
      warrantyInformation: formData.warrantyInformation,
      shippingInformation: formData.shippingInformation,
      returnPolicy: formData.returnPolicy,
      minimumOrderQuantity: formData.minimumOrderQuantity || undefined,
      sizes: selectedSizes,
      sizeMeasurements: selectedSizes.map((size) => {
        const mData = sizeMeasurements[size] || {};
        const measurementObj = { size };
        activeFields.forEach((f) => {
          if (mData[f.key] !== undefined && mData[f.key] !== "") {
            measurementObj[f.key] = mData[f.key];
          }
        });
        return measurementObj;
      }),
      colors: processedColors,
      thumbnail,
      tags: formData.tags
        ? formData.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [],
      images,
    };
    updateMutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Helmet>
          <title>{`Admin Product Details | ${siteName}`}</title>
        </Helmet>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="py-20 text-center">
        <Helmet>
          <title>{`Admin Product Details | ${siteName}`}</title>
        </Helmet>
        <p className="text-sm text-muted-foreground">Product not found.</p>
        <Button className="mt-4 rounded-lg" onClick={() => router.push("/dashboard/products")}>
          Back to Products
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Admin Product Details | {siteName}</title>
      </Helmet>
      <Button
        variant="ghost"
        size="sm"
        className="mb-2"
        onClick={() => router.push("/dashboard/products")}
      >
        <ArrowLeft className="size-4" data-icon="inline-start" />
        Back to Products
      </Button>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            <img
              src={product.thumbnail || product.images?.[0] || undefined}
              alt={product.title}
              className="size-16 shrink-0 rounded-xl object-cover"
            />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {product.title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{product.brand} &middot; {product.category}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!showDeleteConfirm ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="size-4" data-icon="inline-start" />
                Delete
              </Button>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2">
                <span className="text-sm text-foreground">Delete this product?</span>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(product._id)}
                >
                  {deleteMutation.isPending ? "..." : "Yes"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  No
                </Button>
              </div>
            )}
          </div>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="rounded-xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Edit Product</h2>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="rounded-lg"
            >
              <Save className="size-4" data-icon="inline-start" />
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-foreground">Title</label>
                <Input {...register("title")} placeholder="Product title" className={errors.title ? "border-destructive" : ""} />
                {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title.message}</p>}
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-foreground">Description</label>
                <textarea
                  {...register("description")}
                  rows={4}
                  placeholder="Product description"
                  className={`w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring ${errors.description ? "border-destructive" : ""}`}
                />
                {errors.description && <p className="mt-1 text-xs text-destructive">{errors.description.message}</p>}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Category</label>
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
                <label className="mb-1 block text-sm font-medium text-foreground">Price in BDT</label>
                <Input {...register("price")} type="number" step="0.01" placeholder="৳0" className={errors.price ? "border-destructive" : ""} />
                {errors.price && <p className="mt-1 text-xs text-destructive">{errors.price.message}</p>}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Discount %</label>
                <Input {...register("discountPercentage")} type="number" step="0.1" min="0" max="100" placeholder="0" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Stock</label>
                <Input {...register("stock")} type="number" min="0" placeholder="0" className={errors.stock ? "border-destructive" : ""} />
                {errors.stock && <p className="mt-1 text-xs text-destructive">{errors.stock.message}</p>}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Weight (g)</label>
                <Input {...register("weight")} type="number" step="0.1" placeholder="0" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Min Order Qty</label>
                <Input {...register("minimumOrderQuantity")} type="number" min="1" placeholder="1" />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-foreground">Tags (comma separated)</label>
                <Input {...register("tags")} placeholder="e.g. wireless, bluetooth" />
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
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-3 transition-colors hover:border-muted-foreground/50 ${thumbnailDrag ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  {(thumbnailPreview || product.thumbnail) ? (
                    <img src={thumbnailPreview || product.thumbnail} alt="Thumbnail" className="size-16 rounded-lg object-cover" />
                  ) : (
                    <div className="flex size-16 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                      Upload
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Click to replace thumbnail</p>
                    <p>PNG, JPG up to 5MB</p>
                  </div>
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
                    setImageFiles(files);
                    setImagePreviews(files.map((f) => URL.createObjectURL(f)));
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
                      setImageFiles(files);
                      setImagePreviews(files.map((f) => URL.createObjectURL(f)));
                    }
                  }}
                  className={`cursor-pointer rounded-lg border border-dashed p-3 transition-colors hover:border-muted-foreground/50 ${imagesDrag ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  {imagePreviews.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {imagePreviews.map((src, i) => (
                        <img key={i} src={src} alt="" className="size-16 rounded-lg object-cover" />
                      ))}
                    </div>
                  ) : product.images?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {product.images.slice(0, 4).map((img, i) => (
                        <img key={i} src={img} alt="" className="size-16 rounded-lg object-cover" />
                      ))}
                      {product.images.length > 4 && (
                        <div className="flex size-16 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                          +{product.images.length - 4}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex size-16 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                      Upload
                    </div>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">Click to replace images (PNG, JPG)</p>
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
          </div>
        </form>
      </motion.div>
    </div>
  );
}
