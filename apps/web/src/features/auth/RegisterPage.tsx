import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { registerSchema, type RegisterInput } from "@dailyloop/shared";
import { api, ApiClientError } from "../../lib/api-client";
import { useInvalidateAuth } from "../../lib/use-auth";
import { Button } from "../../components/Button";
import { TextField } from "../../components/TextField";
import { AuthLayout } from "./AuthLayout";

export function RegisterPage() {
  const navigate = useNavigate();
  const invalidateAuth = useInvalidateAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (values: RegisterInput) => {
    setFormError(null);
    try {
      await api.post("/auth/register", values);
      await invalidateAuth();
      navigate("/", { replace: true });
    } catch (error) {
      setFormError(error instanceof ApiClientError ? error.message : "Something went wrong. Try again.");
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="New puzzles every day. Beat your friends.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <TextField
          label="Display name"
          autoComplete="name"
          error={errors.displayName?.message}
          {...register("displayName")}
        />
        <TextField label="Username" autoComplete="username" error={errors.username?.message} {...register("username")} />
        <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />
        {formError ? (
          <p role="alert" className="text-sm font-medium text-rose-400">
            {formError}
          </p>
        ) : null}
        <Button type="submit" isLoading={isSubmitting} className="mt-2 w-full">
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-white/50">
        Already playing?{" "}
        <Link to="/login" className="font-semibold text-brand-300 hover:text-brand-200">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
