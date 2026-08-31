import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { updateProfileSchema, changePasswordSchema, type UpdateProfileInput } from "@dailyloop/shared";
import { useAuth, useInvalidateAuth } from "../../lib/use-auth";
import { useUpdateProfile, useChangePassword } from "../../lib/profile-api";
import { useToast } from "../../lib/toast-context";
import { ApiClientError } from "../../lib/api-client";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { TextField } from "../../components/TextField";

const changePasswordFormSchema = changePasswordSchema
  .extend({ confirmPassword: z.string().min(1) })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
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
      <h2 className="mb-4 font-display text-lg font-bold text-white">Profile</h2>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <TextField label="Display name" error={errors.displayName?.message} {...register("displayName")} />
        <TextField label="Bio" placeholder="Tell people a little about yourself" error={errors.bio?.message} {...register("bio")} />
        <Button type="submit" isLoading={isSubmitting} className="self-start">
          Save changes
        </Button>
      </form>
    </Card>
  );
}

function PasswordSection() {
  const navigate = useNavigate();
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
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Failed to change password", "error");
    }
  };

  return (
    <Card>
      <h2 className="mb-4 font-display text-lg font-bold text-white">Change password</h2>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register("currentPassword")}
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          error={errors.newPassword?.message}
          {...register("newPassword")}
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
        <Button type="submit" isLoading={isSubmitting} className="self-start">
          Change password
        </Button>
      </form>
    </Card>
  );
}

export function SettingsPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <h1 className="font-display text-2xl font-bold text-white">Settings</h1>
      <ProfileSection />
      <PasswordSection />
    </div>
  );
}
