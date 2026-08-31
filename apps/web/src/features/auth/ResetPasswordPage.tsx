import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { passwordResetConfirmSchema, type PasswordResetConfirmInput } from "@dailyloop/shared";
import { api, ApiClientError } from "../../lib/api-client";
import { Button } from "../../components/Button";
import { TextField } from "../../components/TextField";
import { Icon } from "../../components/Icon";
import { AuthLayout } from "./AuthLayout";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordResetConfirmInput>({
    resolver: zodResolver(passwordResetConfirmSchema),
    defaultValues: { token },
  });

  const onSubmit = async (values: PasswordResetConfirmInput) => {
    setFormError(null);
    try {
      await api.post("/auth/password-reset/confirm", values);
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 2000);
    } catch (error) {
      setFormError(error instanceof ApiClientError ? error.message : "Something went wrong.");
    }
  };

  if (!token) {
    return (
      <AuthLayout title="Invalid link" subtitle="This password reset link is missing its token.">
        <Link to="/forgot-password" className="font-semibold text-brand-300 hover:text-brand-200">
          Request a new link
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="Make it something you'll remember.">
      {done ? (
        <p className="text-sm text-white/70">Password updated. Redirecting you to login…</p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <input type="hidden" {...register("token")} />
          <TextField
            label="New password"
            icon="lock"
            type="password"
            autoComplete="new-password"
            error={errors.newPassword?.message}
            {...register("newPassword")}
          />
          {formError ? (
            <p role="alert" className="text-sm font-medium text-rose-400">
              {formError}
            </p>
          ) : null}
          <Button type="submit" isLoading={isSubmitting} className="mt-2 w-full">
            <Icon name="lock_reset" className="text-lg" /> Update password
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
