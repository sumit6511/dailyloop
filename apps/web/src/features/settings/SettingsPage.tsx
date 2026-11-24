import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod/mini";
import { useNavigate } from "react-router-dom";
import {
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
  type UpdateProfileInput,
  type DeleteAccountInput,
} from "@dailyloop/shared";
import { useAuth, useForgetSession, useInvalidateAuth } from "../../lib/use-auth";
import { useUpdateProfile, useChangePassword, useDeleteAccount } from "../../lib/profile-api";
import { useToast } from "../../lib/toast-context";
import { ApiClientError } from "../../lib/api-client";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { TextField } from "../../components/TextField";
import { Icon } from "../../components/Icon";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Page } from "../../components/Page";
import { PageHeader } from "../../components/PageHeader";
import { SectionHeader } from "../../components/SectionHeader";
import { SegmentedControl } from "../../components/SegmentedControl";
import { useTheme } from "../../lib/use-theme";

const changePasswordFormSchema = z
  .extend(changePasswordSchema, { confirmPassword: z.string().check(z.minLength(1)) })
  .check(
    z.refine((data) => data.newPassword === data.confirmPassword, {
      message: "Passwords don't match",
      path: ["confirmPassword"],
    }),
  );
type ChangePasswordFormInput = z.infer<typeof changePasswordFormSchema>;

function ProfileSection() {
  const { user } = useAuth();
  const invalidateAuth = useInvalidateAuth();
  const updateProfile = useUpdateProfile();
  const { showToast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { displayName: user?.displayName ?? "", bio: user?.bio ?? "" },
  });

  const onSubmit = async (values: UpdateProfileInput) => {
    try {
      await updateProfile.mutateAsync(values);
      await invalidateAuth();
      showToast("Profile updated", "success");
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Failed to update profile", "error");
    }
  };

  return (
    <Card>
      <SectionHeader
        title="Profile"
        icon="badge"
        description="How you appear to friends and on leaderboards."
      />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <TextField
          label="Display name"
          icon="badge"
          error={errors.displayName?.message}
          {...register("displayName")}
        />
        <TextField
          label="Bio"
          icon="notes"
          placeholder="Tell people a little about yourself"
          error={errors.bio?.message}
          {...register("bio")}
        />
        <Button type="submit" isLoading={isSubmitting} className="self-start">
          <Icon name="save" className="text-lg" /> Save changes
        </Button>
      </form>
    </Card>
  );
}

const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

function AppearanceSection() {
  const { preference, setPreference } = useTheme();
  return (
    <Card>
      <SectionHeader
        title="Appearance"
        icon="contrast"
        description="System follows your device's light or dark setting."
      />
      <SegmentedControl
        aria-label="Theme"
        options={THEME_OPTIONS}
        value={preference}
        onChange={setPreference}
        className="max-w-sm"
      />
    </Card>
  );
}

function PasswordSection() {
  const navigate = useNavigate();
  const forgetSession = useForgetSession();
  const changePassword = useChangePassword();
  const { showToast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormInput>({ resolver: zodResolver(changePasswordFormSchema) });

  const onSubmit = async (values: ChangePasswordFormInput) => {
    try {
      await changePassword.mutateAsync(values);
      reset();
      showToast("Password changed — please log in again", "success");
      navigate("/login", { replace: true });
      forgetSession(); // the server ended every session, this one included
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Failed to change password", "error");
    }
  };

  return (
    <Card>
      <SectionHeader
        title="Change password"
        icon="lock_reset"
        description="You'll be signed out everywhere, including here."
      />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <TextField
          label="Current password"
          icon="lock"
          type="password"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register("currentPassword")}
        />
        <TextField
          label="New password"
          icon="lock_reset"
          type="password"
          autoComplete="new-password"
          error={errors.newPassword?.message}
          {...register("newPassword")}
        />
        <TextField
          label="Confirm new password"
          icon="lock_reset"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
        <Button type="submit" isLoading={isSubmitting} className="self-start">
          <Icon name="lock_reset" className="text-lg" /> Change password
        </Button>
      </form>
    </Card>
  );
}

function DeleteAccountSection() {
  const navigate = useNavigate();
  const forgetSession = useForgetSession();
  const deleteAccount = useDeleteAccount();
  const { showToast } = useToast();
  const [pending, setPending] = useState<DeleteAccountInput | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DeleteAccountInput>({ resolver: zodResolver(deleteAccountSchema) });

  const confirmDelete = async () => {
    if (!pending) return;
    try {
      await deleteAccount.mutateAsync(pending);
      setPending(null);
      showToast("Your account has been deleted", "success");
      navigate("/login", { replace: true });
      forgetSession();
    } catch (err) {
      setPending(null);
      const message = err instanceof ApiClientError ? err.message : "Failed to delete account";
      if (err instanceof ApiClientError && err.status === 400) {
        setError("password", { message });
      } else {
        showToast(message, "error");
      }
    }
  };

  return (
    <Card className="!border-rose-500/25">
      <SectionHeader
        title="Delete account"
        icon="delete"
        iconClassName="text-rose-300"
        description="Permanently removes your account, scores, streak, achievements and friends. This can't be undone."
      />
      <form
        onSubmit={handleSubmit((values) => setPending(values))}
        noValidate
        className="flex flex-col gap-4"
      >
        <TextField
          label="Confirm with your password"
          icon="lock"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <Button type="submit" variant="danger" className="self-start">
          <Icon name="delete" className="text-lg" /> Delete account
        </Button>
      </form>
      <ConfirmDialog
        open={pending !== null}
        title="Delete your account?"
        body="Your scores, streak, achievements and friendships will be gone for good."
        confirmLabel="Delete forever"
        danger
        confirmIcon="delete"
        isLoading={deleteAccount.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPending(null)}
      />
    </Card>
  );
}

export function SettingsPage() {
  return (
    <Page width="narrow">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Your profile, password and account."
      />
      <ProfileSection />
      <AppearanceSection />
      <PasswordSection />
      <DeleteAccountSection />
    </Page>
  );
}
