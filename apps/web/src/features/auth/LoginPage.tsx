import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { loginSchema, type LoginInput } from "@dailyloop/shared";
import { api, ApiClientError } from "../../lib/api-client";
import { useInvalidateAuth } from "../../lib/use-auth";
import { Button } from "../../components/Button";
import { TextField } from "../../components/TextField";
import { Icon } from "../../components/Icon";
import { AuthLayout } from "./AuthLayout";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const invalidateAuth = useInvalidateAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginInput) => {
    setFormError(null);
    try {
      await api.post("/auth/login", values);
      await invalidateAuth();
      const redirectTo = (location.state as { from?: string } | null)?.from ?? "/";
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setFormError(error instanceof ApiClientError ? error.message : "Something went wrong. Try again.");
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Pick up your streak where you left off.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <TextField
          label="Email or username"
          icon="person"
          autoComplete="username"
          error={errors.emailOrUsername?.message}
          {...register("emailOrUsername")}
        />
        <TextField
          label="Password"
          icon="lock"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />
        {formError ? (
          <p role="alert" className="text-sm font-medium text-rose-400">
            {formError}
          </p>
        ) : null}
        <div className="flex items-center justify-end text-sm">
          <Link to="/forgot-password" className="font-medium text-brand-300 hover:text-brand-200">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" isLoading={isSubmitting} className="mt-2 w-full">
          <Icon name="login" className="text-lg" /> Log in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-white/50">
        New here?{" "}
        <Link to="/register" className="font-semibold text-brand-300 hover:text-brand-200">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
