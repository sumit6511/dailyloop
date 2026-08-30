import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { passwordResetRequestSchema, type PasswordResetRequestInput } from "@dailyloop/shared";
import { api } from "../../lib/api-client";
import { Button } from "../../components/Button";
import { TextField } from "../../components/TextField";
import { AuthLayout } from "./AuthLayout";

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordResetRequestInput>({ resolver: zodResolver(passwordResetRequestSchema) });

  const onSubmit = async (values: PasswordResetRequestInput) => {
    await api.post("/auth/password-reset/request", values);
    setSent(true);
  };

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a reset link if the account exists.">
      {sent ? (
        <p className="text-sm text-white/70">
          If an account exists for that email, a reset link is on its way. Check your inbox.
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <Button type="submit" isLoading={isSubmitting} className="mt-2 w-full">
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-white/50">
        <Link to="/login" className="font-semibold text-brand-300 hover:text-brand-200">
          Back to login
        </Link>
      </p>
    </AuthLayout>
  );
}
