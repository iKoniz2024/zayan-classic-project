"use client";

import { useState, useRef} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Settings, Upload, Camera, Loader2, X } from "lucide-react";
import { getSettings, updateSettings } from "@/services/settings.api";
import { Button } from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Helmet } from "react-helmet-async";
import useSettings from "@/hooks/useSettings";

import { compressImage } from "@/utils/compressImage";

const toBase64 = (file) => compressImage(file);

export default function AdminSettings({ children }) {
  const { siteName: settingsName } = useSettings();
  const queryClient = useQueryClient();
  const { isLoading, data } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const [siteName, setSiteName] = useState("");
  const [siteNameEdited, setSiteNameEdited] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoDrag, setLogoDrag] = useState(false);
  const logoInputRef = useRef(null);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [googleMapLink, setGoogleMapLink] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [emailEdited, setEmailEdited] = useState(false);
  const [phoneEdited, setPhoneEdited] = useState(false);
  const [addressEdited, setAddressEdited] = useState(false);
  const [mapEdited, setMapEdited] = useState(false);
  const [fbEdited, setFbEdited] = useState(false);
  const [instaEdited, setInstaEdited] = useState(false);
  const [tiktokEdited, setTiktokEdited] = useState(false);
  const [ytEdited, setYtEdited] = useState(false);

  const displaySiteName = siteNameEdited ? siteName : (data?.siteName || "");
  const displayLogo = logoPreview || data?.logo || "";
  const displayEmail = emailEdited ? contactEmail : (data?.contactEmail || "");
  const displayPhone = phoneEdited ? contactPhone : (data?.contactPhone || "");
  const displayAddress = addressEdited ? address : (data?.address || "");
  const displayGoogleMapLink = mapEdited ? googleMapLink : (data?.googleMapLink || "");
  const displayFacebookUrl = fbEdited ? facebookUrl : (data?.facebookUrl || "");
  const displayInstagramUrl = instaEdited ? instagramUrl : (data?.instagramUrl || "");
  const displayTiktokUrl = tiktokEdited ? tiktokUrl : (data?.tiktokUrl || "");
  const displayYoutubeUrl = ytEdited ? youtubeUrl : (data?.youtubeUrl || "");

  const handleSiteNameChange = (e) => {
    setSiteNameEdited(true);
    setSiteName(e.target.value);
  };

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (res) => {
      toast.success("Settings updated successfully");
      const updatedData = res?.data || res;
      queryClient.setQueryData(["settings"], updatedData);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSiteNameEdited(false);
      setEmailEdited(false);
      setPhoneEdited(false);
      setAddressEdited(false);
      setMapEdited(false);
      setFbEdited(false);
      setInstaEdited(false);
      setTiktokEdited(false);
      setYtEdited(false);
      if (res?.data?.logo || res?.logo) {
        setLogoPreview(res?.data?.logo || res?.logo);
        setLogoFile(null);
      }
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to update settings");
    },
  });

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleLogoChange = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const hasSiteName = displaySiteName.trim().length > 0;
    const hasLogo = displayLogo && displayLogo.length > 0;

    if (!hasSiteName && !hasLogo) {
      toast.error("Please enter a site name and upload a logo");
      return;
    }
    if (!hasSiteName) {
      toast.error("Please enter a site name");
      return;
    }
    if (!hasLogo) {
      toast.error("Please upload a logo");
      return;
    }

    let logo = displayLogo;
    if (logoFile) {
      logo = await toBase64(logoFile);
    }
    mutation.mutate({
      siteName: displaySiteName,
      logo,
      contactEmail: displayEmail,
      contactPhone: displayPhone,
      address: displayAddress,
      googleMapLink: displayGoogleMapLink,
      facebookUrl: displayFacebookUrl,
      instagramUrl: displayInstagramUrl,
      tiktokUrl: displayTiktokUrl,
      youtubeUrl: displayYoutubeUrl,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Helmet>
        <title>{`Settings | ${settingsName}`}</title>
      </Helmet>

      <div className="flex items-center gap-3">
        <Settings className="size-6 text-foreground" />
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Site Settings</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Site Name</label>
            <Input
              value={displaySiteName}
              onChange={handleSiteNameChange}
              placeholder={settingsName}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Contact Email</label>
            <Input
              value={displayEmail}
              onChange={(e) => { setEmailEdited(true); setContactEmail(e.target.value); }}
              placeholder="info@example.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Contact Phone</label>
            <Input
              value={displayPhone}
              onChange={(e) => { setPhoneEdited(true); setContactPhone(e.target.value); }}
              placeholder="+880 1XXXXXXXXX"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Address</label>
            <Input
              value={displayAddress}
              onChange={(e) => { setAddressEdited(true); setAddress(e.target.value); }}
              placeholder="Dhaka, Bangladesh"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-foreground">Logo</label>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoChange(file);
                e.target.value = "";
              }}
            />
            <div
              onClick={() => logoInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setLogoDrag(true); }}
              onDragLeave={() => setLogoDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setLogoDrag(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleLogoChange(file);
              }}
              className={`cursor-pointer rounded-xl border-2 border-dashed p-5 transition-all duration-200 hover:border-primary/50 hover:bg-primary/5 ${logoDrag ? "border-primary bg-primary/10 scale-[1.01]" : "border-border"}`}
            >
              {displayLogo ? (
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img
                      src={displayLogo}
                      alt="Logo"
                      className="h-16 w-16 rounded-xl object-contain ring-2 ring-border"
                    />
                    <div className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Camera className="size-3" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Change logo</p>
                    {logoFile && (
                      <p className="text-xs text-muted-foreground">{formatFileSize(logoFile.size)}</p>
                    )}
                    <p className="text-xs text-muted-foreground">JPEG, PNG, WebP, SVG, GIF, AVIF</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLogoFile(null);
                      setLogoPreview("");
                      if (logoInputRef.current) logoInputRef.current.value = "";
                    }}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className={`flex size-16 items-center justify-center rounded-xl transition-colors ${logoDrag ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                    <Upload className="size-7" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">Click to upload logo</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">JPEG, PNG, WebP, SVG, GIF, AVIF</p>
                    <p className="mt-1.5 text-xs text-primary">or drag & drop</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-foreground">Google Maps Link</label>
            <Input
              value={displayGoogleMapLink}
              onChange={(e) => { setMapEdited(true); setGoogleMapLink(e.target.value); }}
              placeholder="https://www.google.com/maps/embed?..."
            />
            <p className="mt-1 text-xs text-muted-foreground">Go to Google Maps → Share → Embed a map → Copy the embed URL (starts with https://www.google.com/maps/embed)</p>
          </div>
        </div>

        <div className="border-t border-border pt-6 space-y-4">
          <h3 className="text-base font-semibold text-foreground">Social Media Links</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Facebook URL</label>
              <Input
                value={displayFacebookUrl}
                onChange={(e) => { setFbEdited(true); setFacebookUrl(e.target.value); }}
                placeholder="https://facebook.com/yourpage"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Instagram URL</label>
              <Input
                value={displayInstagramUrl}
                onChange={(e) => { setInstaEdited(true); setInstagramUrl(e.target.value); }}
                placeholder="https://instagram.com/yourprofile"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">TikTok URL</label>
              <Input
                value={displayTiktokUrl}
                onChange={(e) => { setTiktokEdited(true); setTiktokUrl(e.target.value); }}
                placeholder="https://tiktok.com/@yourprofile"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">YouTube URL</label>
              <Input
                value={displayYoutubeUrl}
                onChange={(e) => { setYtEdited(true); setYoutubeUrl(e.target.value); }}
                placeholder="https://youtube.com/@yourchannel"
              />
            </div>
          </div>
        </div>

        <div className="pt-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
