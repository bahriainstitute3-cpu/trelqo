import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  PRIVILEGED_EMAILS,
  SETTINGS_ADMIN_EMAILS,
  normalizeEmail,
} from "../lib/allowedEmails";
import {
  listProductPermissions,
  setProductPermission,
} from "../lib/permissions";
import {
  listBanners,
  createBanner,
  updateBanner,
  deleteBanner,
} from "../lib/banners";
import {
  updateAppConfig,
  getCachedConfig,
  normalizeLogoUrl,
} from "../lib/appConfig";
import {
  uploadAppLogo,
  uploadBannerImage,
  uploadBannerVideo,
} from "../lib/storage";
import { listUsers, forceLogoutUser } from "../lib/users";

export default function Settings() {
  const { user } = useAuth();

  // =========================================================
  // APP CONFIG
  // =========================================================
  const cachedConfig = getCachedConfig() || {};

  const [appConfig, setAppConfig] = useState(cachedConfig);

  const [appName, setAppName] = useState(
    cachedConfig.appName || "Trelqo"
  );

  const [appLogo, setAppLogo] = useState(
    cachedConfig.appLogo || ""
  );

  const [contactEmail, setContactEmail] = useState(
    cachedConfig.contactEmail || ""
  );

  const [contactPhone, setContactPhone] = useState(
    cachedConfig.contactPhone || ""
  );

  const [logoUploading, setLogoUploading] = useState(false);

  const [tickerEnabled, setTickerEnabled] = useState(
    cachedConfig.tickerEnabled || false
  );

  const [tickerText, setTickerText] = useState(
    cachedConfig.tickerText || ""
  );

  const [tickerBgColor, setTickerBgColor] = useState(
    cachedConfig.tickerBgColor || "#123b36"
  );

  const [tickerTextColor, setTickerTextColor] = useState(
    cachedConfig.tickerTextColor || "#ffffff"
  );

  // =========================================================
  // SELLER PERMISSIONS / USERS
  // =========================================================
  const [permissions, setPermissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [newSellerEmail, setNewSellerEmail] = useState("");

  // =========================================================
  // ACTIVE USERS
  // =========================================================
  const [activeUsers, setActiveUsers] = useState([]);
  const [activeUsersLoading, setActiveUsersLoading] = useState(false);

  // =========================================================
  // BANNERS
  // =========================================================
  const [banners, setBanners] = useState([]);

  const [bannerMediaType, setBannerMediaType] = useState("image");
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerImageUrl, setBannerImageUrl] = useState("");
  const [bannerVideoUrl, setBannerVideoUrl] = useState("");
  const [bannerLink, setBannerLink] = useState("/");
  const [bannerActive, setBannerActive] = useState(true);

  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerVideoUploading, setBannerVideoUploading] = useState(false);

  // =========================================================
  // EDIT BANNER
  // =========================================================
  const [editingBannerId, setEditingBannerId] = useState(null);
  const [editMediaType, setEditMediaType] = useState("image");
  const [editTitle, setEditTitle] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editVideoUrl, setEditVideoUrl] = useState("");
  const [editLink, setEditLink] = useState("/");
  const [editUploading, setEditUploading] = useState(false);

  // =========================================================
  // UI STATE
  // =========================================================
  const [tab, setTab] = useState("app");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  // =========================================================
  // ACCESS CONTROL
  // =========================================================
  const canManage =
    !!user &&
    (SETTINGS_ADMIN_EMAILS || []).includes(
      normalizeEmail(user.email)
    );

  // =========================================================
  // ENABLED SELLERS
  // =========================================================
  const enabledSellerEmails = useMemo(() => {
    return new Set([
      ...(PRIVILEGED_EMAILS || []),
      ...permissions
        .filter((item) => item.granted)
        .map((item) => normalizeEmail(item.email)),
    ]);
  }, [permissions]);

  // =========================================================
  // STAFF USERS
  // =========================================================
  const staffUsers = useMemo(() => {
    return users.filter((item) => {
      const email = normalizeEmail(item.email);

      return (
        enabledSellerEmails.has(email) ||
        ["admin", "super_admin"].includes(item.role)
      );
    });
  }, [users, enabledSellerEmails]);

  // =========================================================
  // SELLER USERS
  // =========================================================
  const sellerUsers = useMemo(() => {
    return users.filter((item) =>
      enabledSellerEmails.has(normalizeEmail(item.email))
    );
  }, [users, enabledSellerEmails]);

  // =========================================================
  // ACTIVE USER DETECTOR
  // =========================================================
  function isUserActive(item) {
    if (!item) return false;

    return (
      item.active === true ||
      item.isActive === true ||
      item.online === true ||
      item.status === "active" ||
      item.status === "online"
    );
  }

  // =========================================================
  // LOAD ACTIVE / ALL USERS
  // =========================================================
  async function loadActiveUsers() {
    if (!canManage) return;

    setActiveUsersLoading(true);

    try {
      const latestUsers = await listUsers();

      const safeUsers = Array.isArray(latestUsers)
        ? latestUsers
        : [];

      setUsers(safeUsers);
      setActiveUsers(safeUsers.filter(isUserActive));
    } catch (err) {
      console.error("Could not load active users:", err);
    } finally {
      setActiveUsersLoading(false);
    }
  }

  // =========================================================
  // LOAD SETTINGS ON ACCESS
  // =========================================================
  useEffect(() => {
    if (!canManage) return;

    loadAllSettings();
  }, [canManage]);

  // =========================================================
  // AUTO REFRESH USERS
  // =========================================================
  useEffect(() => {
    if (!canManage) return;

    const interval = setInterval(() => {
      loadActiveUsers();
    }, 5000);

    return () => clearInterval(interval);
  }, [canManage]);

  // =========================================================
  // LOAD ALL SETTINGS
  // =========================================================
  async function loadAllSettings() {
    setLoading(true);
    setError("");

    try {
      const config = getCachedConfig() || {};

      setAppConfig(config);
      setAppName(config.appName || "ub");
      setAppLogo(config.appLogo || "");
      setContactEmail(config.contactEmail || "");
      setContactPhone(config.contactPhone || "");
      setTickerEnabled(config.tickerEnabled || false);
      setTickerText(config.tickerText || "");
      setTickerBgColor(config.tickerBgColor || "#123b36");
      setTickerTextColor(config.tickerTextColor || "#ffffff");

      const [
        permsResult,
        bannersResult,
        usersResult,
      ] = await Promise.allSettled([
        listProductPermissions(),
        listBanners(),
        listUsers(),
      ]);

      if (permsResult.status === "fulfilled") {
        setPermissions(permsResult.value || []);
      }

      if (bannersResult.status === "fulfilled") {
        setBanners(bannersResult.value || []);
      }

      if (usersResult.status === "fulfilled") {
        const loadedUsers = Array.isArray(usersResult.value)
          ? usersResult.value
          : [];

        setUsers(loadedUsers);
        setActiveUsers(loadedUsers.filter(isUserActive));
      }

      const failures = [];

      if (permsResult.status === "rejected") {
        failures.push({
          label: "Seller permissions",
          err: permsResult.reason,
        });
      }

      if (bannersResult.status === "rejected") {
        failures.push({
          label: "Banners",
          err: bannersResult.reason,
        });
      }

      if (usersResult.status === "rejected") {
        failures.push({
          label: "Users",
          err: usersResult.reason,
        });
      }

      if (failures.length > 0) {
        failures.forEach((failure) => {
          console.error(
            `Could not load "${failure.label}":`,
            failure.err
          );
        });

        const isPermissionIssue = failures.some(
          (failure) =>
            failure.err?.code === "permission-denied"
        );

        setError(
          `Could not load: ${failures
            .map((failure) => failure.label)
            .join(", ")}.` +
            (isPermissionIssue
              ? " This looks like a Firestore permissions issue — make sure the latest firestore.rules has been deployed and that you're signed in with the settings-admin account."
              : "")
        );
      }
    } catch (err) {
      console.error(err);
      setError("Could not load settings");
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // EMAIL USER
  // =========================================================
  function handleEmailUser(email) {
    const safeEmail = normalizeEmail(email);

    if (!safeEmail) {
      setError("This user does not have a valid email address.");
      return;
    }

    setError("");
    setSuccess("");

    window.location.href = `mailto:${encodeURIComponent(
      safeEmail
    )}`;
  }

  // =========================================================
  // WHATSAPP USER
  // =========================================================
  function handleWhatsAppUser(userItem) {
    const rawPhone =
      userItem?.phone ||
      userItem?.phoneNumber ||
      userItem?.mobile ||
      userItem?.mobileNumber ||
      userItem?.whatsapp ||
      userItem?.whatsappNumber ||
      userItem?.contact ||
      userItem?.contactNumber ||
      "";

    let phone = String(rawPhone).replace(/\D/g, "");

    if (!phone) {
      setError(
        "This user does not have a WhatsApp/mobile number saved."
      );
      return;
    }

    // 03001234567 -> 923001234567
    if (phone.startsWith("0")) {
      phone = "92" + phone.substring(1);
    }

    // 00923001234567 -> 923001234567
    if (phone.startsWith("0092")) {
      phone = phone.substring(2);
    }

    // 3001234567 -> 923001234567
    if (!phone.startsWith("92") && phone.length === 10) {
      phone = "92" + phone;
    }

    setError("");
    setSuccess("");

    window.open(
      `https://wa.me/${phone}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  // =========================================================
  // ACCESS DENIED
  // =========================================================
  if (!canManage) {
    return (
      <div
        className="container empty-state"
        style={{ padding: 60 }}
      >
        <div
          style={{
            fontSize: 28,
            marginBottom: 10,
          }}
        >
          🔒
        </div>

        <div
          style={{
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          Access Denied
        </div>

        <div
          style={{
            fontSize: 13,
            color: "var(--ink-soft)",
            marginTop: 4,
          }}
        >
          Only authorized administrators can access settings.
        </div>
      </div>
    );
  }

  // =========================================================
  // LOADING
  // =========================================================
  if (loading) {
    return (
      <div
        className="container"
        style={{
          padding: 60,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 24,
            marginBottom: 10,
          }}
        >
          ⏳
        </div>

        <div>Loading settings...</div>
      </div>
    );
  }

  // =========================================================
  // SAVE APP CONFIG
  // =========================================================
  async function handleSaveAppConfig() {
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const updates = {
        appName: appName.trim(),
        appLogo: appLogo.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        tickerEnabled: !!tickerEnabled,
        tickerText: tickerText.trim(),
        tickerBgColor,
        tickerTextColor,
      };

      await updateAppConfig(updates);

      localStorage.setItem(
        "shopName",
        appName.trim()
      );

      localStorage.setItem(
        "shopLogo",
        appLogo.trim()
      );

      window.dispatchEvent(
        new Event("shopNameUpdated")
      );

      setAppConfig((current) => ({
        ...current,
        ...updates,
      }));

      setSuccess("✓ App settings saved!");

      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (err) {
      setError(
        err.message || "Could not save settings"
      );
    } finally {
      setBusy(false);
    }
  }

  // =========================================================
  // LOGO UPLOAD
  // =========================================================
  async function handleLogoUpload(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }

    setLogoUploading(true);
    setError("");
    setSuccess("");

    try {
      const logoUrl = await uploadAppLogo(file);

      setAppLogo(logoUrl);

      await updateAppConfig({
        appLogo: logoUrl,
      });

      localStorage.setItem(
        "shopLogo",
        logoUrl
      );

      window.dispatchEvent(
        new Event("shopNameUpdated")
      );

      setAppConfig((current) => ({
        ...current,
        appLogo: logoUrl,
      }));

      setSuccess(
        "✓ Logo uploaded and saved!"
      );
    } catch (err) {
      setError(
        err.message || "Could not upload logo"
      );
    } finally {
      setLogoUploading(false);
      event.target.value = "";
    }
  }

  // =========================================================
  // ADD SELLER
  // =========================================================
  async function handleAddSeller() {
    setError("");
    setSuccess("");

    if (!newSellerEmail.trim()) {
      setError("Please enter a seller email.");
      return;
    }

    setBusy(true);

    try {
      await setProductPermission(
        newSellerEmail.trim(),
        true
      );

      setSuccess(
        `✓ ${newSellerEmail.trim()} can now add products!`
      );

      setNewSellerEmail("");

      const perms = await listProductPermissions();
      setPermissions(perms || []);
    } catch (err) {
      setError(
        err.message || "Could not add seller"
      );
    } finally {
      setBusy(false);
    }
  }

  // =========================================================
  // TOGGLE SELLER
  // =========================================================
  async function handleToggleSeller(
    email,
    currentGrant
  ) {
    setBusy(true);
    setError("");

    try {
      await setProductPermission(
        email,
        !currentGrant
      );

      setSuccess(`✓ Updated ${email}`);

      const perms = await listProductPermissions();
      setPermissions(perms || []);
    } catch (err) {
      setError(
        err.message || "Could not update seller"
      );
    } finally {
      setBusy(false);
    }
  }

  // =========================================================
  // REMOTE LOGOUT
  // =========================================================
  async function handleRemoteLogout(
    userId,
    email
  ) {
    if (!userId) {
      setError("This user does not have a valid user ID.");
      return;
    }

    if (
      !window.confirm(
        `Force logout user ${email}?`
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      await forceLogoutUser(userId);

      setActiveUsers((current) =>
        current.filter(
          (item) => item.id !== userId
        )
      );

      setUsers((current) =>
        current.map((item) =>
          item.id === userId
            ? {
                ...item,
                active: false,
                isActive: false,
                online: false,
                status: "offline",
              }
            : item
        )
      );

      setSuccess(
        `✓ ${email} will be signed out on their other device(s) within moments.`
      );
    } catch (err) {
      setError(
        err.message || "Could not logout user"
      );
    } finally {
      setBusy(false);
    }
  }

  // =========================================================
  // BANNER IMAGE UPLOAD
  // =========================================================
  async function handleBannerFileUpload(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }

    setBannerUploading(true);
    setError("");
    setSuccess("");

    try {
      let uploadedUrl = "";

      if (typeof uploadBannerImage === "function") {
        uploadedUrl = await uploadBannerImage(file);
      } else {
        uploadedUrl = URL.createObjectURL(file);
      }

      setBannerImageUrl(uploadedUrl);

      setSuccess(
        "✓ Banner image uploaded successfully!"
      );
    } catch (err) {
      setError(
        err.message || "Could not upload banner image"
      );
    } finally {
      setBannerUploading(false);
      event.target.value = "";
    }
  }

  // =========================================================
  // BANNER VIDEO UPLOAD
  // =========================================================
  async function handleBannerVideoFileUpload(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setError("Please select a valid video file.");
      return;
    }

    setBannerVideoUploading(true);
    setError("");
    setSuccess("");

    try {
      const uploadedUrl =
        await uploadBannerVideo(file);

      setBannerVideoUrl(uploadedUrl);

      setSuccess(
        "✓ Banner video uploaded successfully!"
      );
    } catch (err) {
      setError(
        err.message || "Could not upload banner video"
      );
    } finally {
      setBannerVideoUploading(false);
      event.target.value = "";
    }
  }

  // =========================================================
  // CREATE BANNER
  // =========================================================
  async function handleCreateBanner() {
    setError("");
    setSuccess("");

    if (!bannerTitle.trim()) {
      setError("Title is required");
      return;
    }

    if (
      bannerMediaType === "video" &&
      !bannerVideoUrl.trim()
    ) {
      setError("Please add a banner video");
      return;
    }

    if (
      bannerMediaType === "image" &&
      !bannerImageUrl.trim()
    ) {
      setError("Please add a banner image");
      return;
    }

    setBusy(true);

    try {
      await createBanner({
        title: bannerTitle.trim(),
        mediaType: bannerMediaType,

        imageUrl:
          bannerMediaType === "image"
            ? bannerImageUrl.trim()
            : "",

        videoUrl:
          bannerMediaType === "video"
            ? bannerVideoUrl.trim()
            : "",

        link: bannerLink || "/",
        active: bannerActive,
        objectPosition: "50% 50%",
      });

      setSuccess(
        bannerMediaType === "video"
          ? "✓ Video banner created!"
          : "✓ Banner created!"
      );

      setBannerTitle("");
      setBannerImageUrl("");
      setBannerVideoUrl("");
      setBannerLink("/");
      setBannerActive(true);
      setBannerMediaType("image");

      const bannersList = await listBanners();
      setBanners(bannersList || []);

      window.dispatchEvent(
        new Event("bannersUpdated")
      );
    } catch (err) {
      setError(
        err.message || "Could not create banner"
      );
    } finally {
      setBusy(false);
    }
  }

  // =========================================================
  // TOGGLE BANNER
  // =========================================================
  async function handleToggleBanner(
    bannerId,
    active
  ) {
    setBusy(true);
    setError("");

    try {
      await updateBanner(
        bannerId,
        {
          active: !active,
        }
      );

      const bannersList = await listBanners();
      setBanners(bannersList || []);

      window.dispatchEvent(
        new Event("bannersUpdated")
      );

      setSuccess("✓ Banner updated!");
    } catch (err) {
      setError(
        err.message || "Could not update banner"
      );
    } finally {
      setBusy(false);
    }
  }

  // =========================================================
  // DELETE BANNER
  // =========================================================
  async function handleDeleteBanner(bannerId) {
    if (!window.confirm("Delete this banner?")) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await deleteBanner(bannerId);

      const bannersList = await listBanners();
      setBanners(bannersList || []);

      window.dispatchEvent(
        new Event("bannersUpdated")
      );

      setSuccess("✓ Banner deleted!");
    } catch (err) {
      setError(
        err.message || "Could not delete banner"
      );
    } finally {
      setBusy(false);
    }
  }

  // =========================================================
  // START EDIT BANNER
  // =========================================================
  function handleStartEditBanner(banner) {
    setEditingBannerId(banner.id);

    setEditMediaType(
      banner.mediaType === "video"
        ? "video"
        : "image"
    );

    setEditTitle(banner.title || "");
    setEditImageUrl(banner.imageUrl || "");
    setEditVideoUrl(banner.videoUrl || "");
    setEditLink(banner.link || "/");

    setError("");
    setSuccess("");
  }

  // =========================================================
  // EDIT IMAGE UPLOAD
  // =========================================================
  async function handleEditImageFileUpload(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }

    setEditUploading(true);
    setError("");
    setSuccess("");

    try {
      const uploadedUrl =
        await uploadBannerImage(file);

      setEditImageUrl(uploadedUrl);

      setSuccess(
        "✓ New banner image uploaded!"
      );
    } catch (err) {
      setError(
        err.message || "Could not upload banner image"
      );
    } finally {
      setEditUploading(false);
      event.target.value = "";
    }
  }

  // =========================================================
  // EDIT VIDEO UPLOAD
  // =========================================================
  async function handleEditVideoFileUpload(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setError("Please select a valid video file.");
      return;
    }

    setEditUploading(true);
    setError("");
    setSuccess("");

    try {
      const uploadedUrl =
        await uploadBannerVideo(file);

      setEditVideoUrl(uploadedUrl);

      setSuccess(
        "✓ New banner video uploaded!"
      );
    } catch (err) {
      setError(
        err.message || "Could not upload banner video"
      );
    } finally {
      setEditUploading(false);
      event.target.value = "";
    }
  }

  // =========================================================
  // SAVE BANNER EDIT
  // =========================================================
  async function handleSaveBannerEdit(bannerId) {
    setError("");
    setSuccess("");

    if (!editTitle.trim()) {
      setError("Title is required");
      return;
    }

    if (
      editMediaType === "video" &&
      !editVideoUrl.trim()
    ) {
      setError("Please add a banner video");
      return;
    }

    if (
      editMediaType === "image" &&
      !editImageUrl.trim()
    ) {
      setError("Please add a banner image");
      return;
    }

    setBusy(true);

    try {
      await updateBanner(
        bannerId,
        {
          title: editTitle.trim(),
          mediaType: editMediaType,

          imageUrl:
            editMediaType === "image"
              ? editImageUrl.trim()
              : "",

          videoUrl:
            editMediaType === "video"
              ? editVideoUrl.trim()
              : "",

          link: editLink || "/",
          objectPosition: "50% 50%",
        }
      );

      const bannersList = await listBanners();
      setBanners(bannersList || []);

      window.dispatchEvent(
        new Event("bannersUpdated")
      );

      setSuccess("✓ Banner updated!");
      setEditingBannerId(null);
    } catch (err) {
      setError(
        err.message || "Could not update banner"
      );
    } finally {
      setBusy(false);
    }
  }

  // =========================================================
  // RENDER
  // =========================================================
  return (
    <div
      className="container"
      style={{
        padding: "32px 20px",
        maxWidth: 900,
      }}
    >
      <h1
        style={{
          fontSize: 28,
          marginBottom: 8,
          fontWeight: 800,
        }}
      >
        ⚙️ Settings
      </h1>

      <p
        style={{
          color: "var(--ink-soft)",
          marginBottom: 24,
        }}
      >
        Admin only. Manage your marketplace settings.
      </p>

      {/* =====================================================
          STATS
      ====================================================== */}
      <div
        className="settings-stats"
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(4, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div className="card settings-stat">
          <strong>{users.length}</strong>
          <span>Registered users</span>
        </div>

        <div className="card settings-stat">
          <strong>
            {new Set([
              ...(PRIVILEGED_EMAILS || []),
              ...permissions
                .filter((item) => item.granted)
                .map((item) =>
                  normalizeEmail(item.email)
                ),
            ]).size}
          </strong>

          <span>Active sellers</span>
        </div>

        <div className="card settings-stat">
          <strong>
            {
              users.filter(
                (item) => item.blocked
              ).length
            }
          </strong>

          <span>Blocked users</span>
        </div>

        <div
          className="card settings-stat active-users-stat"
          style={{
            border:
              "1.5px solid rgba(0,150,136,0.25)",
            background:
              "rgba(0,150,136,0.04)",
          }}
        >
          <strong
            style={{
              color: "var(--teal)",
            }}
          >
            {activeUsers.length}
          </strong>

          <span>Active users</span>
        </div>
      </div>

      {/* =====================================================
          ACTIVE USERS
      ====================================================== */}
      <div
        className="card"
        style={{
          padding: 22,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 17,
                fontWeight: 800,
                margin: 0,
              }}
            >
              🟢 Active Users
            </h2>

            <p
              style={{
                margin: "5px 0 0",
                color: "var(--ink-soft)",
                fontSize: 12,
              }}
            >
              Users currently active in the app
            </p>
          </div>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={loadActiveUsers}
            disabled={activeUsersLoading}
          >
            {activeUsersLoading
              ? "Refreshing..."
              : "↻ Refresh"}
          </button>
        </div>

        {activeUsers.length === 0 ? (
          <div
            style={{
              padding: 22,
              textAlign: "center",
              border:
                "1px dashed var(--line)",
              borderRadius: 10,
              color: "var(--ink-soft)",
              fontSize: 13,
            }}
          >
            {activeUsersLoading
              ? "Checking active users..."
              : "No active users right now."}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 10,
            }}
          >
            {activeUsers.map((activeUser, index) => {
              const email = normalizeEmail(
                activeUser.email
              );

              const displayName =
                activeUser.name ||
                activeUser.displayName ||
                "Unnamed User";

              const role =
                activeUser.role || "User";

              const photo =
                activeUser.photoURL ||
                activeUser.photoUrl ||
                activeUser.photo ||
                activeUser.avatar ||
                "";

              return (
                <div
                  key={
                    activeUser.id ||
                    email ||
                    index
                  }
                  className="active-user-row"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                      "space-between",
                    gap: 14,
                    padding: 14,
                    border:
                      "1px solid var(--line)",
                    borderRadius: 12,
                    background:
                      "var(--surface-alt)",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        overflow: "hidden",
                        flexShrink: 0,
                        background: "#e6f9f7",
                        color: "var(--teal)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: 16,
                      }}
                    >
                      {photo ? (
                        <img
                          src={photo}
                          alt={displayName}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display =
                              "none";
                          }}
                        />
                      ) : (
                        displayName
                          .charAt(0)
                          .toUpperCase()
                      )}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          flexWrap: "wrap",
                        }}
                      >
                        <strong
                          style={{
                            fontSize: 14,
                          }}
                        >
                          {displayName}
                        </strong>

                        <span
                          style={{
                            background:
                              "#e6f9f7",
                            color:
                              "var(--teal)",
                            borderRadius: 999,
                            padding:
                              "3px 7px",
                            fontSize: 10,
                            fontWeight: 800,
                          }}
                        >
                          ● ONLINE
                        </span>
                      </div>

                      <div
                        style={{
                          marginTop: 3,
                          fontSize: 12,
                          color:
                            "var(--ink-soft)",
                          wordBreak:
                            "break-word",
                        }}
                      >
                        {email || "No email"}
                      </div>

                      <div
                        style={{
                          marginTop: 3,
                          fontSize: 11,
                          color: "var(--teal)",
                          fontWeight: 700,
                        }}
                      >
                        Role: {role}
                      </div>
                    </div>
                  </div>

                  {/* USER ACTIONS */}
                  <div
                    className="user-action-buttons"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    {/* EMAIL */}
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() =>
                        handleEmailUser(email)
                      }
                      disabled={!email}
                      style={{
                        whiteSpace: "nowrap",
                        background: "#2563eb",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding:
                          "8px 12px",
                        cursor: email
                          ? "pointer"
                          : "not-allowed",
                        fontWeight: 700,
                      }}
                      title={`Email ${
                        email || "user"
                      }`}
                    >
                      📧 Mail
                    </button>

                    

                    {/* LOGOUT */}
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() =>
                        handleRemoteLogout(
                          activeUser.id,
                          email || displayName
                        )
                      }
                      disabled={
                        busy ||
                        !activeUser.id
                      }
                      style={{
                        whiteSpace: "nowrap",
                      }}
                    >
                      🚪 Logout
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =====================================================
          ALL REGISTERED USERS
      ====================================================== */}
      <div
        className="card"
        style={{
          padding: 22,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 17,
                fontWeight: 800,
                margin: 0,
              }}
            >
              👥 All Registered Users ({users.length})
            </h2>

            <p
              style={{
                margin: "5px 0 0",
                color: "var(--ink-soft)",
                fontSize: 12,
              }}
            >
              All users registered in Trelqo
            </p>
          </div>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={loadActiveUsers}
            disabled={activeUsersLoading}
          >
            {activeUsersLoading
              ? "Refreshing..."
              : "↻ Refresh Users"}
          </button>
        </div>

        {users.length === 0 ? (
          <div
            style={{
              padding: 22,
              textAlign: "center",
              border:
                "1px dashed var(--line)",
              borderRadius: 10,
              color: "var(--ink-soft)",
              fontSize: 13,
            }}
          >
            No registered users found.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 10,
            }}
          >
            {users.map((registeredUser, index) => {
              const email = normalizeEmail(
                registeredUser.email
              );

              const displayName =
                registeredUser.name ||
                registeredUser.displayName ||
                "Unnamed User";

              const role =
                registeredUser.role || "User";

              const photo =
                registeredUser.photoURL ||
                registeredUser.photoUrl ||
                registeredUser.photo ||
                registeredUser.avatar ||
                "";

              const isActive =
                isUserActive(registeredUser);

              return (
                <div
                  key={
                    registeredUser.id ||
                    email ||
                    index
                  }
                  className="registered-user-row"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                      "space-between",
                    gap: 14,
                    padding: 14,
                    border:
                      "1px solid var(--line)",
                    borderRadius: 12,
                    background:
                      "var(--surface-alt)",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        overflow: "hidden",
                        flexShrink: 0,
                        background: isActive
                          ? "#e6f9f7"
                          : "#f1f3f5",
                        color: isActive
                          ? "var(--teal)"
                          : "var(--ink-soft)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: 16,
                      }}
                    >
                      {photo ? (
                        <img
                          src={photo}
                          alt={displayName}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display =
                              "none";
                          }}
                        />
                      ) : (
                        displayName
                          .charAt(0)
                          .toUpperCase()
                      )}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          flexWrap: "wrap",
                        }}
                      >
                        <strong
                          style={{
                            fontSize: 14,
                          }}
                        >
                          {displayName}
                        </strong>

                        <span
                          style={{
                            background: isActive
                              ? "#e6f9f7"
                              : "#f3f4f6",
                            color: isActive
                              ? "var(--teal)"
                              : "var(--ink-soft)",
                            borderRadius: 999,
                            padding:
                              "3px 7px",
                            fontSize: 10,
                            fontWeight: 800,
                          }}
                        >
                          {isActive
                            ? "● ONLINE"
                            : "○ OFFLINE"}
                        </span>
                      </div>

                      <div
                        style={{
                          marginTop: 3,
                          fontSize: 12,
                          color:
                            "var(--ink-soft)",
                          wordBreak:
                            "break-word",
                        }}
                      >
                        {email || "No email"}
                      </div>

                      <div
                        style={{
                          marginTop: 3,
                          fontSize: 11,
                          color: "var(--teal)",
                          fontWeight: 700,
                        }}
                      >
                        Role: {role}
                      </div>
                    </div>
                  </div>

                  {/* REGISTERED USER ACTIONS */}
                  <div
                    className="user-action-buttons"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    {/* EMAIL */}
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() =>
                        handleEmailUser(email)
                      }
                      disabled={!email}
                      style={{
                        whiteSpace: "nowrap",
                        background: "#2563eb",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding:
                          "8px 12px",
                        cursor: email
                          ? "pointer"
                          : "not-allowed",
                        fontWeight: 700,
                      }}
                      title={`Email ${
                        email || "user"
                      }`}
                    >
                      📧 Mail
                    </button>

                   

    {/* FORCE LOGOUT */}
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() =>
                        handleRemoteLogout(
                          registeredUser.id,
                          email || displayName
                        )
                      }
                      disabled={
                        busy ||
                        !registeredUser.id
                      }
                      style={{
                        whiteSpace: "nowrap",
                      }}
                    >
                      🚪 Force Logout
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =====================================================
          TAB NAVIGATION
      ====================================================== */}
      <div
        style={{
          display: "flex",
          gap: 16,
          borderBottom:
            "2px solid var(--line)",
          marginBottom: 28,
          overflowX: "auto",
        }}
      >
        {["app", "sellers", "banners"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              padding: "12px 0",
              borderBottom:
                tab === t
                  ? "3px solid var(--teal)"
                  : "none",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              color:
                tab === t
                  ? "var(--teal)"
                  : "var(--ink-soft)",
              background: "none",
              borderLeft: "none",
              borderRight: "none",
              borderTop: "none",
              textTransform: "capitalize",
              whiteSpace: "nowrap",
            }}
          >
            {t === "app" && "🏪 App Settings"}
            {t === "sellers" && "👥 Sellers"}
            {t === "banners" && "🎨 Banners"}
          </button>
        ))}
      </div>

      {/* =====================================================
          APP SETTINGS
      ====================================================== */}
      {tab === "app" && (
        <div
          style={{
            display: "grid",
            gap: 24,
          }}
        >
          <div
            className="card"
            style={{
              padding: 22,
            }}
          >
            <h2
              style={{
                fontSize: 16,
                fontWeight: 800,
                marginBottom: 16,
              }}
            >
              App Branding
            </h2>

            <div
              style={{
                display: "grid",
                gap: 14,
              }}
            >
              <div className="field">
                <label>App Name</label>

                <input
                  value={appName}
                  onChange={(e) =>
                    setAppName(e.target.value)
                  }
                  placeholder="Trelqo"
                />
              </div>

              <div className="field">
                <label>App Logo URL</label>

                <input
                  value={appLogo}
                  onChange={(e) =>
                    setAppLogo(e.target.value)
                  }
                  placeholder="https://example.com/logo.png"
                />
              </div>

              <label
                className="btn btn-outline"
                style={{
                  width: "fit-content",
                  cursor: "pointer",
                }}
              >
                {logoUploading
                  ? "Uploading..."
                  : "Choose logo from device"}

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={logoUploading}
                  hidden
                />
              </label>

              {normalizeLogoUrl &&
                normalizeLogoUrl(appLogo) && (
                  <div
                    style={{
                      textAlign: "center",
                      padding: 12,
                      background:
                        "var(--surface-alt)",
                      borderRadius: 10,
                    }}
                  >
                    <img
                      src={normalizeLogoUrl(appLogo)}
                      alt="Logo"
                      style={{
                        maxWidth: 150,
                        maxHeight: 60,
                        objectFit: "contain",
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display =
                          "none";
                      }}
                    />
                  </div>
                )}

              <div className="field">
                <label>Contact Email</label>

                <input
                  value={contactEmail}
                  onChange={(e) =>
                    setContactEmail(e.target.value)
                  }
                  placeholder="support@example.com"
                />
              </div>

              <div className="field">
                <label>Contact Phone</label>

                <input
                  value={contactPhone}
                  onChange={(e) =>
                    setContactPhone(e.target.value)
                  }
                  placeholder="+92-300-1234567"
                />
              </div>

              <button
                type="button"
                className="btn btn-accent"
                onClick={handleSaveAppConfig}
                disabled={busy}
              >
                {busy
                  ? "Saving…"
                  : "💾 Save Settings"}
              </button>
            </div>
          </div>

          {/* TICKER */}
          <div
            className="card"
            style={{
              padding: 22,
            }}
          >
            <h2
              style={{
                fontSize: 16,
                fontWeight: 800,
                marginBottom: 4,
              }}
            >
              📢 Announcement Ticker
            </h2>

            <p
              style={{
                fontSize: 13,
                color: "var(--ink-soft)",
                marginBottom: 16,
              }}
            >
              A scrolling message shown at the very top of the app.
            </p>

            <div
              style={{
                display: "grid",
                gap: 14,
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                <input
                  type="checkbox"
                  checked={tickerEnabled}
                  onChange={(e) =>
                    setTickerEnabled(
                      e.target.checked
                    )
                  }
                />

                Show announcement ticker
              </label>

              <div className="field">
                <label>Ticker Text</label>

                <input
                  value={tickerText}
                  onChange={(e) =>
                    setTickerText(e.target.value)
                  }
                  placeholder="🎉 Summer Sale is live!"
                />
              </div>

              <div
                className="color-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1fr 1fr",
                  gap: 12,
                }}
              >
                <div className="field">
                  <label>Background Color</label>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                    }}
                  >
                    <input
                      type="color"
                      value={tickerBgColor}
                      onChange={(e) =>
                        setTickerBgColor(
                          e.target.value
                        )
                      }
                    />

                    <input
                      value={tickerBgColor}
                      onChange={(e) =>
                        setTickerBgColor(
                          e.target.value
                        )
                      }
                    />
                  </div>
                </div>

                <div className="field">
                  <label>Text Color</label>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                    }}
                  >
                    <input
                      type="color"
                      value={tickerTextColor}
                      onChange={(e) =>
                        setTickerTextColor(
                          e.target.value
                        )
                      }
                    />

                    <input
                      value={tickerTextColor}
                      onChange={(e) =>
                        setTickerTextColor(
                          e.target.value
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              {tickerText.trim() && (
                <div
                  style={{
                    borderRadius: 10,
                    background: tickerBgColor,
                    color: tickerTextColor,
                    padding: "8px 14px",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  Preview: {tickerText}
                </div>
              )}

              <button
                type="button"
                className="btn btn-accent"
                onClick={handleSaveAppConfig}
                disabled={busy}
              >
                {busy
                  ? "Saving…"
                  : "💾 Save Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          SELLERS TAB
      ====================================================== */}
      {tab === "sellers" && (
        <div
          style={{
            display: "grid",
            gap: 24,
          }}
        >
          {/* ADD SELLER */}
          <div
            className="card"
            style={{
              padding: 22,
            }}
          >
            <h2
              style={{
                fontSize: 16,
                fontWeight: 800,
                marginBottom: 16,
              }}
            >
              Add New Seller
            </h2>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <input
                value={newSellerEmail}
                onChange={(e) =>
                  setNewSellerEmail(e.target.value)
                }
                placeholder="seller@example.com"
                style={{
                  flex: 1,
                  minWidth: 220,
                }}
              />

              <button
                type="button"
                className="btn btn-accent"
                onClick={handleAddSeller}
                disabled={busy}
              >
                ✅ Add Seller
              </button>
            </div>
          </div>

          {/* ACTIVE SELLERS */}
          <div
            className="card"
            style={{
              padding: 22,
            }}
          >
            <h2
              style={{
                fontSize: 16,
                fontWeight: 800,
                marginBottom: 16,
              }}
            >
              Active Sellers ({enabledSellerEmails.size})
            </h2>

            {sellerUsers.length === 0 &&
            permissions.length === 0 ? (
              <div
                style={{
                  color: "var(--ink-soft)",
                  fontSize: 13,
                }}
              >
                No sellers yet. Add one above.
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 10,
                }}
              >
                {sellerUsers.map((seller) => {
                  const email = normalizeEmail(
                    seller.email
                  );

                  const protectedSeller =
                    (PRIVILEGED_EMAILS || []).includes(
                      email
                    );

                  return (
                    <div
                      key={
                        seller.id || email
                      }
                      style={{
                        padding: "14px 16px",
                        display: "flex",
                        justifyContent:
                          "space-between",
                        alignItems: "center",
                        background: "#e6f9f7",
                        borderRadius: 10,
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 14,
                          }}
                        >
                          {seller.name ||
                            "Unnamed seller"}
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            color:
                              "var(--ink-soft)",
                            marginTop: 2,
                            wordBreak:
                              "break-word",
                          }}
                        >
                          {email}
                        </div>
                      </div>

                      {protectedSeller ? (
                        <span className="staff-role">
                          Admin seller
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() =>
                            handleToggleSeller(
                              email,
                              true
                            )
                          }
                          disabled={busy}
                        >
                          Remove seller
                        </button>
                      )}
                    </div>
                  );
                })}

                {permissions
                  .filter(
                    (permission) =>
                      permission.granted &&
                      !sellerUsers.some(
                        (seller) =>
                          normalizeEmail(
                            seller.email
                          ) ===
                          normalizeEmail(
                            permission.email
                          )
                      )
                  )
                  .map((permission) => (
                    <div
                      key={
                        permission.id ||
                        permission.email
                      }
                      style={{
                        padding: "14px 16px",
                        display: "flex",
                        justifyContent:
                          "space-between",
                        alignItems: "center",
                        background: "#e6f9f7",
                        borderRadius: 10,
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 14,
                          }}
                        >
                          {permission.email}
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            color:
                              "var(--ink-soft)",
                            marginTop: 2,
                          }}
                        >
                          Permission enabled,
                          user has not logged in yet
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() =>
                          handleToggleSeller(
                            permission.email,
                            true
                          )
                        }
                        disabled={busy}
                      >
                        Remove seller
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* STAFF */}
          <div
            className="card"
            style={{
              padding: 22,
            }}
          >
            <h2
              style={{
                fontSize: 16,
                fontWeight: 800,
                marginBottom: 16,
              }}
            >
              Sellers & Admins (Live Logged In Users)
            </h2>

            {staffUsers.length === 0 ? (
              <div
                style={{
                  color: "var(--ink-soft)",
                  fontSize: 13,
                }}
              >
                No seller or admin profiles found.
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 10,
                }}
              >
                {staffUsers.map((item) => {
                  const email = normalizeEmail(
                    item.email
                  );

                  const isAdminAccount =
                    ["admin", "super_admin"].includes(
                      item.role
                    ) ||
                    (PRIVILEGED_EMAILS || []).includes(
                      email
                    );

                  const userRole = isAdminAccount
                    ? "Admin"
                    : "Seller";

                  return (
                    <div
                      key={item.id || email}
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        alignItems: "center",
                        padding: 12,
                        border:
                          "1px solid var(--line)",
                        borderRadius: 10,
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 14,
                          }}
                        >
                          {item.name ||
                            "Unnamed user"}{" "}
                          <span
                            style={{
                              fontSize: 12,
                              color:
                                "var(--teal)",
                              fontWeight: 800,
                            }}
                          >
                            ({userRole})
                          </span>
                        </div>

                        <div
                          style={{
                            color:
                              "var(--ink-soft)",
                            fontSize: 12,
                            wordBreak:
                              "break-word",
                          }}
                        >
                          {email}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <span className="staff-role">
                          {userRole}
                        </span>

                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() =>
                            handleRemoteLogout(
                              item.id,
                              email
                            )
                          }
                          disabled={
                            busy || !item.id
                          }
                        >
                          🚪 Logout
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================
          BANNERS TAB
      ====================================================== */}
      {tab === "banners" && (
        <div
          style={{
            display: "grid",
            gap: 24,
          }}
        >
          {/* CREATE BANNER */}
          <div
            className="card"
            style={{
              padding: 22,
            }}
          >
            <h2
              style={{
                fontSize: 16,
                fontWeight: 800,
                marginBottom: 16,
              }}
            >
              Create Banner
            </h2>

            <div
              style={{
                display: "grid",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  className={`btn btn-sm ${
                    bannerMediaType === "image"
                      ? "btn-accent"
                      : "btn-outline"
                  }`}
                  onClick={() =>
                    setBannerMediaType("image")
                  }
                >
                  🖼️ Image banner
                </button>

                <button
                  type="button"
                  className={`btn btn-sm ${
                    bannerMediaType === "video"
                      ? "btn-accent"
                      : "btn-outline"
                  }`}
                  onClick={() =>
                    setBannerMediaType("video")
                  }
                >
                  🎥 Video banner
                </button>
              </div>

              <div className="field">
                <label>Banner Title</label>

                <input
                  value={bannerTitle}
                  onChange={(e) =>
                    setBannerTitle(e.target.value)
                  }
                  placeholder="e.g., Summer Sale 50% Off"
                />
              </div>

              {bannerMediaType === "image" ? (
                <>
                  <div className="field">
                    <label>Image URL</label>

                    <input
                      value={bannerImageUrl}
                      onChange={(e) =>
                        setBannerImageUrl(
                          e.target.value
                        )
                      }
                      placeholder="https://example.com/banner.jpg"
                    />
                  </div>

                  <label
                    className="btn btn-outline"
                    style={{
                      cursor: "pointer",
                      width: "fit-content",
                    }}
                  >
                    {bannerUploading
                      ? "Uploading Image..."
                      : "📁 Add banner from device"}

                    <input
                      type="file"
                      accept="image/*"
                      onChange={
                        handleBannerFileUpload
                      }
                      disabled={bannerUploading}
                      hidden
                    />
                  </label>

                  {bannerImageUrl && (
                    <div
                      style={{
                        width: "100%",
                        borderRadius: 10,
                        border:
                          "2px solid var(--line)",
                        overflow: "hidden",
                        background: "#fff",
                        display: "flex",
                        justifyContent:
                          "center",
                        alignItems:
                          "center",
                      }}
                    >
                      <img
                        src={bannerImageUrl}
                        alt="Banner Preview"
                        style={{
                          display: "block",
                          width: "100%",
                          height: "auto",
                          maxWidth: "100%",
                          objectFit: "contain",
                          objectPosition:
                            "center",
                        }}
                      />
                    </div>
                  )}

                  <div
                    style={{
                      padding: 12,
                      background:
                        "var(--surface-alt)",
                      borderRadius: 10,
                      fontSize: 12,
                      color:
                        "var(--ink-soft)",
                    }}
                  >
                    💡{" "}
                    <strong>
                      Responsive banner:
                    </strong>{" "}
                    complete image remains
                    visible. No cropping and no
                    manual position adjustment.
                  </div>
                </>
              ) : (
                <>
                  <div className="field">
                    <label>Video URL</label>

                    <input
                      value={bannerVideoUrl}
                      onChange={(e) =>
                        setBannerVideoUrl(
                          e.target.value
                        )
                      }
                      placeholder="https://example.com/banner.mp4"
                    />
                  </div>

                  <label
                    className="btn btn-outline"
                    style={{
                      cursor: "pointer",
                      width: "fit-content",
                    }}
                  >
                    {bannerVideoUploading
                      ? "Uploading Video..."
                      : "📁 Add banner video from device"}

                    <input
                      type="file"
                      accept="video/*"
                      onChange={
                        handleBannerVideoFileUpload
                      }
                      disabled={
                        bannerVideoUploading
                      }
                      hidden
                    />
                  </label>

                  {bannerVideoUrl && (
                    <div
                      style={{
                        width: "100%",
                        borderRadius: 10,
                        border:
                          "2px solid var(--line)",
                        overflow: "hidden",
                        background: "#000",
                      }}
                    >
                      <video
                        src={bannerVideoUrl}
                        muted
                        loop
                        autoPlay
                        playsInline
                        controls
                        style={{
                          display: "block",
                          width: "100%",
                          height: "auto",
                          maxWidth: "100%",
                          objectFit: "contain",
                        }}
                      />
                    </div>
                  )}
                </>
              )}

              <div className="field">
                <label>Link (optional)</label>

                <input
                  value={bannerLink}
                  onChange={(e) =>
                    setBannerLink(e.target.value)
                  }
                  placeholder="/category/electronics or /"
                />
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontWeight: 700,
                }}
              >
                <input
                  type="checkbox"
                  checked={bannerActive}
                  onChange={(e) =>
                    setBannerActive(
                      e.target.checked
                    )
                  }
                />

                Show immediately on Home page
              </label>

              <button
                type="button"
                className="btn btn-accent"
                onClick={handleCreateBanner}
                disabled={
                  busy ||
                  bannerUploading ||
                  bannerVideoUploading
                }
              >
                {busy
                  ? "Creating…"
                  : bannerMediaType === "video"
                  ? "🎥 Create Video Banner"
                  : "🖼️ Create Banner"}
              </button>
            </div>
          </div>

          {/* EXISTING BANNERS */}
          {banners.length > 0 && (
            <div
              className="card"
              style={{
                padding: 22,
              }}
            >
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  marginBottom: 16,
                }}
              >
                Banners (
                {
                  banners.filter(
                    (b) => b.active
                  ).length
                }{" "}
                active)
              </h2>

              <div
                style={{
                  display: "grid",
                  gap: 12,
                }}
              >
                {banners.map((b) => (
                  <div
                    key={b.id}
                    className="card"
                    style={{
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "center",
                        opacity:
                          b.active ? 1 : 0.6,
                        flexWrap: "wrap",
                      }}
                    >
                      {/* THUMBNAIL */}
                      {b.mediaType === "video" &&
                      b.videoUrl ? (
                        <video
                          src={b.videoUrl}
                          muted
                          loop
                          autoPlay
                          playsInline
                          style={{
                            width: 80,
                            height: 60,
                            objectFit: "contain",
                            borderRadius: 8,
                            background: "#000",
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        b.imageUrl && (
                          <div
                            style={{
                              width: 80,
                              height: 60,
                              borderRadius: 8,
                              background: "#fff",
                              overflow: "hidden",
                              display: "flex",
                              alignItems:
                                "center",
                              justifyContent:
                                "center",
                              flexShrink: 0,
                            }}
                          >
                            <img
                              src={b.imageUrl}
                              alt={b.title}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit:
                                  "contain",
                                display: "block",
                              }}
                            />
                          </div>
                        )
                      )}

                      {/* INFO */}
                      <div
                        style={{
                          flex: 1,
                          minWidth: 150,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems:
                              "center",
                            gap: 8,
                            marginBottom: 4,
                            flexWrap: "wrap",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: 14,
                            }}
                          >
                            {b.title}
                          </div>

                          <span
                            style={{
                              background: b.active
                                ? "#e6f9f7"
                                : "#f3f4f6",
                              color: b.active
                                ? "var(--teal)"
                                : "var(--ink-soft)",
                              borderRadius: 999,
                              fontSize: 10,
                              fontWeight: 800,
                              padding:
                                "4px 8px",
                            }}
                          >
                            {b.active
                              ? "LIVE"
                              : "DRAFT"}
                          </span>

                          <span
                            style={{
                              background:
                                "#eef2f7",
                              color:
                                "var(--ink-soft)",
                              borderRadius: 999,
                              fontSize: 10,
                              fontWeight: 800,
                              padding:
                                "4px 8px",
                            }}
                          >
                            {b.mediaType === "video"
                              ? "🎥 VIDEO"
                              : "🖼️ IMAGE"}
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            color:
                              "var(--ink-soft)",
                          }}
                        >
                          {b.link || "Home"}
                        </div>
                      </div>

                      {/* ACTIONS */}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          handleStartEditBanner(b)
                        }
                        disabled={busy}
                      >
                        ✏️ Edit
                      </button>

                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          handleToggleBanner(
                            b.id,
                            b.active
                          )
                        }
                        disabled={busy}
                      >
                        {b.active
                          ? "👁️ Hide"
                          : "👁️‍🗨️ Show"}
                      </button>

                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() =>
                          handleDeleteBanner(b.id)
                        }
                        disabled={busy}
                      >
                        🗑️
                      </button>
                    </div>

                    {/* EDIT */}
                    {editingBannerId === b.id && (
                      <div
                        style={{
                          marginTop: 12,
                          display: "grid",
                          gap: 10,
                          padding: 12,
                          background:
                            "var(--surface-alt)",
                          borderRadius: 10,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                          }}
                        >
                          <button
                            type="button"
                            className={`btn btn-sm ${
                              editMediaType === "image"
                                ? "btn-accent"
                                : "btn-outline"
                            }`}
                            onClick={() =>
                              setEditMediaType(
                                "image"
                              )
                            }
                          >
                            🖼️ Image
                          </button>

                          <button
                            type="button"
                            className={`btn btn-sm ${
                              editMediaType === "video"
                                ? "btn-accent"
                                : "btn-outline"
                            }`}
                            onClick={() =>
                              setEditMediaType(
                                "video"
                              )
                            }
                          >
                            🎥 Video
                          </button>
                        </div>

                        <div className="field">
                          <label>Title</label>

                          <input
                            value={editTitle}
                            onChange={(e) =>
                              setEditTitle(
                                e.target.value
                              )
                            }
                          />
                        </div>

                        {editMediaType === "image" ? (
                          <>
                            <div className="field">
                              <label>
                                Image URL
                              </label>

                              <input
                                value={
                                  editImageUrl
                                }
                                onChange={(e) =>
                                  setEditImageUrl(
                                    e.target.value
                                  )
                                }
                              />
                            </div>

                            <label
                              className="btn btn-outline"
                              style={{
                                width: "fit-content",
                                cursor: "pointer",
                              }}
                            >
                              {editUploading
                                ? "Uploading..."
                                : "📁 Replace image"}

                              <input
                                type="file"
                                accept="image/*"
                                onChange={
                                  handleEditImageFileUpload
                                }
                                disabled={
                                  editUploading
                                }
                                hidden
                              />
                            </label>

                            {editImageUrl && (
                              <div
                                style={{
                                  width: "100%",
                                  borderRadius: 8,
                                  border:
                                    "1.5px solid var(--line)",
                                  overflow: "hidden",
                                  background: "#fff",
                                }}
                              >
                                <img
                                  src={
                                    editImageUrl
                                  }
                                  alt={editTitle}
                                  style={{
                                    display:
                                      "block",
                                    width:
                                      "100%",
                                    height:
                                      "auto",
                                    maxWidth:
                                      "100%",
                                    objectFit:
                                      "contain",
                                  }}
                                />
                              </div>
                            )}

                            <div
                              style={{
                                padding: 10,
                                background:
                                  "#fff",
                                borderRadius: 8,
                                fontSize: 12,
                                color:
                                  "var(--ink-soft)",
                              }}
                            >
                              ✓ Complete image
                              remains visible.
                              No crop or manual
                              position adjustment.
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="field">
                              <label>
                                Video URL
                              </label>

                              <input
                                value={
                                  editVideoUrl
                                }
                                onChange={(e) =>
                                  setEditVideoUrl(
                                    e.target.value
                                  )
                                }
                              />
                            </div>

                            <label
                              className="btn btn-outline"
                              style={{
                                width: "fit-content",
                                cursor: "pointer",
                              }}
                            >
                              {editUploading
                                ? "Uploading..."
                                : "📁 Replace video"}

                              <input
                                type="file"
                                accept="video/*"
                                onChange={
                                  handleEditVideoFileUpload
                                }
                                disabled={
                                  editUploading
                                }
                                hidden
                              />
                            </label>

                            {editVideoUrl && (
                              <video
                                src={editVideoUrl}
                                muted
                                loop
                                autoPlay
                                playsInline
                                controls
                                style={{
                                  display: "block",
                                  width: "100%",
                                  height: "auto",
                                  objectFit:
                                    "contain",
                                  background: "#000",
                                  borderRadius: 8,
                                }}
                              />
                            )}
                          </>
                        )}

                        <div className="field">
                          <label>Link</label>

                          <input
                            value={editLink}
                            onChange={(e) =>
                              setEditLink(
                                e.target.value
                              )
                            }
                          />
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            type="button"
                            className="btn btn-accent btn-sm"
                            onClick={() =>
                              handleSaveBannerEdit(
                                b.id
                              )
                            }
                            disabled={
                              busy ||
                              editUploading
                            }
                          >
                            {busy
                              ? "Saving…"
                              : "💾 Save changes"}
                          </button>

                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() =>
                              setEditingBannerId(
                                null
                              )
                            }
                            disabled={busy}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================
          ALERTS
      ====================================================== */}
      {error && (
        <div
          style={{
            background: "#ffe6e6",
            color: "var(--danger)",
            padding: 14,
            borderRadius: 10,
            marginTop: 16,
          }}
        >
          ❌ {error}
        </div>
      )}

      {success && (
        <div
          style={{
            background: "#e6f9f7",
            color: "var(--teal)",
            padding: 14,
            borderRadius: 10,
            marginTop: 16,
          }}
        >
          ✅ {success}
        </div>
      )}

      {/* =====================================================
          RESPONSIVE
      ====================================================== */}
      <style>{`
        .field {
          display: grid;
          gap: 6px;
        }

        .field label {
          font-size: 13px;
          font-weight: 700;
        }

        .field input {
          width: 100%;
          box-sizing: border-box;
          padding: 11px 14px;
          border-radius: 10px;
          border: 1.5px solid var(--line);
          background: var(--surface, #fff);
          color: var(--ink, #111);
        }

        .settings-stat {
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .settings-stat strong {
          font-size: 24px;
          font-weight: 800;
        }

        .settings-stat span {
          font-size: 12px;
          color: var(--ink-soft);
        }

        .active-user-row,
        .registered-user-row {
          transition:
            transform 0.15s ease,
            box-shadow 0.15s ease;
        }

        .active-user-row:hover,
        .registered-user-row:hover {
          transform: translateY(-1px);
          box-shadow:
            0 5px 18px rgba(0,0,0,0.06);
        }

        .user-action-buttons {
          justify-content: flex-end;
        }

        .user-action-buttons button {
          transition:
            transform 0.15s ease,
            opacity 0.15s ease;
        }

        .user-action-buttons button:hover {
          transform: translateY(-1px);
          opacity: 0.92;
        }

        @media (max-width: 850px) {
          .settings-stats {
            grid-template-columns:
              repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 700px) {
          .user-action-buttons {
            width: 100%;
            justify-content: flex-start;
          }
        }

        @media (max-width: 600px) {
          .settings-stats {
            grid-template-columns:
              1fr !important;
          }

          .color-grid {
            grid-template-columns:
              1fr !important;
          }

          .active-user-row,
          .registered-user-row {
            align-items:
              flex-start !important;
          }

          .user-action-buttons {
            width: 100%;
            display: grid !important;
            grid-template-columns:
              1fr 1fr !important;
          }

          .user-action-buttons button:last-child {
            grid-column: 1 / -1;
          }

          .container {
            box-sizing: border-box;
            width: 100%;
          }

          .card {
            box-sizing: border-box;
          }

          .btn {
            max-width: 100%;
          }

          input {
            max-width: 100%;
            box-sizing: border-box;
          }
        }

        @media (max-width: 420px) {
          .user-action-buttons {
            grid-template-columns:
              1fr !important;
          }

          .user-action-buttons button {
            width: 100%;
          }

          .user-action-buttons button:last-child {
            grid-column: auto;
          }
        }
      `}</style>
    </div>
  );
}