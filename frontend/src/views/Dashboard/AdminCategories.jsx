"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { Plus, Trash2, X, FolderTree, ChevronRight, Pencil, Save, Upload} from "lucide-react";
import { getCategories, createCategory, updateCategory, deleteCategory } from "@/services/category.api";
import { Button } from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/skeleton";
import { Helmet } from "react-helmet-async";
import useSettings from "@/hooks/useSettings";

const createCategorySchema = z.object({
  name: z.string().min(2, "Category name is required"),
  slug: z.string().min(2, "Slug is required"),
  children: z.array(
    z.object({
      name: z.string().min(2, "Child name is required"),
      slug: z.string().min(2, "Child slug is required"),
      categories: z.array(z.string()).optional().default([]),
    })
  ).optional().default([]),
});

const updateCategorySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  slug: z.string().min(2, "Slug must be at least 2 characters").optional(),
  children: z.array(
    z.object({
      name: z.string().min(2, "Child name must be at least 2 characters"),
      slug: z.string().min(2, "Child slug must be at least 2 characters"),
      categories: z.array(z.string()).optional().default([]),
    })
  ).optional(),
});

function generateSlug(name) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

import { compressImage } from "@/utils/compressImage";

const toBase64 = (file) => compressImage(file);

export default function AdminCategories({ children }) {
  const { siteName } = useSettings();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [createImage, setCreateImage] = useState("");
  const [editImage, setEditImage] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: getCategories,
    staleTime: 5 * 60 * 1000,
  });

  const categories = data ?? [];

  const {
    register: regCreate,
    handleSubmit: handleSubmitCreate,
    formState: { errors: errCreate },
    reset: resetCreate,
    setError: setErrorCreate,
    control: controlCreate,
  } = useForm({
    resolver: zodResolver(createCategorySchema),
    defaultValues: { name: "", slug: "", children: [] },
  });

  const { fields: createFields, append: createAppend, remove: createRemove } = useFieldArray({
    control: controlCreate,
    name: "children",
  });

  const {
    register: regUpdate,
    handleSubmit: handleSubmitUpdate,
    formState: { errors: errUpdate },
    reset: resetUpdate,
    setError: setErrorUpdate,
    control: controlUpdate,
  } = useForm({
    resolver: zodResolver(updateCategorySchema),
  });

  const { fields: updateFields, append: updateAppend, remove: updateRemove } = useFieldArray({
    control: controlUpdate,
    name: "children",
  });

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: (res, variables) => {
      toast.success("Category created");
      queryClient.setQueryData(["admin-categories"], (old) => {
        const newCategory = {
          _id: res?.insertedId || res?._id || Date.now().toString(),
          ...variables,
        };
        return [...(old || []), newCategory];
      });
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      setShowForm(false);
      resetCreate();
    },
    onError: (err) => {
      const data = err?.response?.data;
      if (data?.errors && Array.isArray(data.errors)) {
        data.errors.forEach((e) => {
          const field = e.path?.[e.path.length - 1];
          if (field) setErrorCreate(field, { message: e.message });
        });
        toast.error("Please fix the errors below");
      } else {
        toast.error(data?.message || data?.error || "Failed to create category");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateCategory(id, payload),
    onSuccess: (res, variables) => {
      toast.success("Category updated");
      queryClient.setQueryData(["admin-categories"], (old) => {
        return (old || []).map((c) =>
          c._id === variables.id ? { ...c, ...variables.payload } : c
        );
      });
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      setEditingId(null);
      resetUpdate();
    },
    onError: (err) => {
      const data = err?.response?.data;
      if (data?.errors && Array.isArray(data.errors)) {
        data.errors.forEach((e) => {
          const field = e.path?.[e.path.length - 1];
          if (field) setErrorUpdate(field, { message: e.message });
        });
        toast.error("Please fix the errors below");
      } else {
        toast.error(data?.message || data?.error || "Failed to update category");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: ["admin-categories"] });
      const previousCategories = queryClient.getQueryData(["admin-categories"]);
      queryClient.setQueryData(["admin-categories"], (old) =>
        (old || []).filter((c) => c._id !== deletedId)
      );
      return { previousCategories };
    },
    onError: (err, deletedId, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(["admin-categories"], context.previousCategories);
      }
      toast.error(err?.response?.data?.message || "Failed to delete category");
    },
    onSuccess: () => {
      toast.success("Category deleted");
      setDeletingId(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries();
    },
  });

  const onCreateSubmit = (formData) => {
    const payload = {
      name: formData.name,
      slug: formData.slug.toLowerCase().replace(/\s+/g, "-"),
      image: createImage,
      children: formData.children.map((child) => ({
        name: child.name,
        slug: child.slug.toLowerCase().replace(/\s+/g, "-"),
        categories: child.categories || [],
      })),
    };
    createMutation.mutate(payload);
  };

  const onUpdateSubmit = (formData) => {
    const payload = {};
    if (formData.name) payload.name = formData.name;
    if (formData.slug) payload.slug = formData.slug.toLowerCase().replace(/\s+/g, "-");
    if (editImage) payload.image = editImage;
    if (formData.children) {
      payload.children = formData.children.map((child) => ({
        name: child.name,
        slug: child.slug.toLowerCase().replace(/\s+/g, "-"),
        categories: child.categories || [],
      }));
    }
    updateMutation.mutate({ id: editingId, payload });
  };

  const handleCreateImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
      return;
    }
    const base64 = await toBase64(file);
    setCreateImage(base64);
  };

  const handleEditImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
      return;
    }
    const base64 = await toBase64(file);
    setEditImage(base64);
  };

  const startEdit = (cat) => {
    setEditingId(cat._id);
    setEditImage(cat.image || "");
    resetUpdate({
      name: cat.name,
      slug: cat.slug,
      children: (cat.children ?? []).map((child) => ({
        name: child.name,
        slug: child.slug,
        categories: child.categories ?? [],
      })),
    });
  };

  return (
    <div className="space-y-6">
      <Helmet>
        <title>{`Admin Categories | ${siteName}`}</title>
      </Helmet>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Categories ({categories.length})
        </h1>
        <Button onClick={() => setShowForm(true)} className="self-start">
          <Plus className="size-4" data-icon="inline-start" />
          Add Category
        </Button>
      </div>

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
              className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowForm(false)}
                className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background"
              >
                <X className="size-4" />
              </button>

              <h2 className="mb-6 text-lg font-semibold text-foreground">Add New Category</h2>

              <form onSubmit={handleSubmitCreate(onCreateSubmit)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Name *</label>
                    <Input
                      {...regCreate("name")}
                      placeholder="e.g. Electronics"
                      className={errCreate.name ? "border-destructive" : ""}
                      onChange={(e) => {
                        regCreate("name").onChange(e);
                        const slugField = document.querySelector('[name="slug"]');
                        if (slugField && !slugField.value) {
                          slugField.value = generateSlug(e.target.value);
                        }
                      }}
                    />
                    {errCreate.name && <p className="mt-1 text-xs text-destructive">{errCreate.name.message}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">Slug *</label>
                    <Input
                      {...regCreate("slug")}
                      placeholder="e.g. electronics"
                      className={errCreate.slug ? "border-destructive" : ""}
                    />
                    {errCreate.slug && <p className="mt-1 text-xs text-destructive">{errCreate.slug.message}</p>}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">Category Image</label>
                  <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border p-4 transition-colors hover:border-primary/50 hover:bg-muted/50">
                    {createImage ? (
                      <img src={createImage} alt="Preview" className="h-20 w-20 rounded-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        <Upload className="size-8" />
                        <p className="text-sm">Click to upload image</p>
                        <p className="text-xs">PNG, JPG up to 2MB</p>
                      </div>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={handleCreateImageUpload} />
                  </label>
                  {createImage && (
                    <button
                      type="button"
                      className="mt-1 text-xs text-destructive hover:text-foreground"
                      onClick={() => setCreateImage("")}
                    >
                      Remove image
                    </button>
                  )}
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">Sub Categories</label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => createAppend({ name: "", slug: "", categories: [] })}
                    >
                      <Plus className="size-3" data-icon="inline-start" />
                      Add Child
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {createFields.map((field, index) => (
                      <div key={field.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-start gap-2">
                          <div className="grid flex-1 grid-cols-2 gap-2">
                            <div>
                              <Input
                                {...regCreate(`children.${index}.name`)}
                                placeholder="Child name"
                                className={errCreate.children?.[index]?.name ? "border-destructive" : ""}
                              />
                              {errCreate.children?.[index]?.name && (
                                <p className="mt-1 text-xs text-destructive">{errCreate.children?.[index]?.name.message}</p>
                              )}
                            </div>
                            <div>
                              <Input
                                {...regCreate(`children.${index}.slug`)}
                                placeholder="child-slug"
                                className={errCreate.children?.[index]?.slug ? "border-destructive" : ""}
                              />
                              {errCreate.children?.[index]?.slug && (
                                <p className="mt-1 text-xs text-destructive">{errCreate.children?.[index]?.slug.message}</p>
                              )}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            onClick={() => createRemove(index)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={createMutation.isPending} className="rounded-lg">
                    {createMutation.isPending ? "Creating..." : "Create Category"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => { setShowForm(false); resetCreate(); setCreateImage(""); }}>
                    Cancel
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-20 text-center">
          <FolderTree className="mx-auto size-12 text-muted-foreground/30" />
          <p className="mt-3 text-sm text-muted-foreground">No categories yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat, i) => {
            const isEditing = editingId === cat._id;
            const isDeleting = deletingId === cat._id;

            return (
              <motion.div
                key={cat._id || cat.slug}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="rounded-xl border border-border bg-card shadow-sm"
              >
                <div className="px-4 py-4 sm:px-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-primary">
                        {cat.image ? (
                          <img src={cat.image} alt={cat.name} className="h-full w-full object-cover" />
                        ) : (
                          <FolderTree className="size-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{cat.name}</p>
                        <p className="text-xs text-muted-foreground">/{cat.slug}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                      {!isDeleting && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={editingId !== null && !isEditing}
                          onClick={() => isEditing ? (setEditingId(null), resetUpdate()) : startEdit(cat)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      )}

                      {!isEditing && (
                        <>
                          {!isDeleting ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:bg-muted hover:text-foreground"
                              disabled={editingId !== null}
                              onClick={() => setDeletingId(cat._id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          ) : (
                            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5">
                              <span className="text-xs text-foreground">Delete?</span>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={deleteMutation.isPending}
                                onClick={() => deleteMutation.mutate(cat._id)}
                              >
                                {deleteMutation.isPending ? "..." : "Yes"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeletingId(null)}
                              >
                                No
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 pl-12 text-xs text-muted-foreground">
                    {cat.children?.length ?? 0} subcategories
                  </div>
                </div>

                {isEditing && (
                  <div className="border-t border-border px-4 py-4 sm:px-5">
                    <form onSubmit={handleSubmitUpdate(onUpdateSubmit)} className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-foreground">Name</label>
                          <Input
                            {...regUpdate("name")}
                            placeholder="Category name"
                            className={errUpdate.name ? "border-destructive" : ""}
                          />
                          {errUpdate.name && <p className="mt-1 text-xs text-destructive">{errUpdate.name.message}</p>}
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-foreground">Slug</label>
                          <Input
                            {...regUpdate("slug")}
                            placeholder="category-slug"
                            className={errUpdate.slug ? "border-destructive" : ""}
                          />
                          {errUpdate.slug && <p className="mt-1 text-xs text-destructive">{errUpdate.slug.message}</p>}
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">Category Image</label>
                        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border p-4 transition-colors hover:border-primary/50 hover:bg-muted/50">
                          {editImage ? (
                            <img src={editImage} alt="Preview" className="h-20 w-20 rounded-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-muted-foreground">
                              <Upload className="size-8" />
                              <p className="text-sm">Click to upload image</p>
                              <p className="text-xs">PNG, JPG up to 2MB</p>
                            </div>
                          )}
                          <input type="file" accept="image/*" className="hidden" onChange={handleEditImageUpload} />
                        </label>
                        {editImage && (
                          <button
                            type="button"
                            className="mt-1 text-xs text-destructive hover:text-foreground"
                            onClick={() => setEditImage("")}
                          >
                            Remove image
                          </button>
                        )}
                      </div>

                      <div>
                        <div className="mb-3 flex items-center justify-between">
                          <label className="text-sm font-medium text-foreground">Sub Categories</label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => updateAppend({ name: "", slug: "", categories: [] })}
                          >
                            <Plus className="size-3" data-icon="inline-start" />
                            Add Child
                          </Button>
                        </div>

                        <div className="space-y-3">
                          {updateFields.map((field, index) => (
                            <div key={field.id} className="rounded-lg border border-border p-3">
                              <div className="flex items-start gap-2">
                                <div className="grid flex-1 grid-cols-2 gap-2">
                                  <div>
                                    <Input
                                      {...regUpdate(`children.${index}.name`)}
                                      placeholder="Child name"
                                      className={errUpdate.children?.[index]?.name ? "border-destructive" : ""}
                                    />
                                    {errUpdate.children?.[index]?.name && (
                                      <p className="mt-1 text-xs text-destructive">{errUpdate.children?.[index]?.name.message}</p>
                                    )}
                                  </div>
                                  <div>
                                    <Input
                                      {...regUpdate(`children.${index}.slug`)}
                                      placeholder="child-slug"
                                      className={errUpdate.children?.[index]?.slug ? "border-destructive" : ""}
                                    />
                                    {errUpdate.children?.[index]?.slug && (
                                      <p className="mt-1 text-xs text-destructive">{errUpdate.children?.[index]?.slug.message}</p>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="mt-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                  onClick={() => updateRemove(index)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <Button type="submit" disabled={updateMutation.isPending} className="rounded-lg">
                          <Save className="size-4" data-icon="inline-start" />
                          {updateMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => { setEditingId(null); resetUpdate(); }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </div>
                )}

                {!isEditing && cat.children?.length > 0 && (
                  <div className="border-t border-border px-4 py-3 sm:px-5">
                    <div className="flex flex-wrap gap-2">
                      {cat.children.map((child) => (
                        <div
                          key={child.slug}
                          className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm"
                        >
                          <ChevronRight className="size-3 text-muted-foreground" />
                          <span className="font-medium text-foreground">{child.name}</span>
                          <span className="text-xs text-muted-foreground">/{child.slug}</span>
                          {child.categories?.length > 0 && (
                            <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                              {child.categories.length}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
