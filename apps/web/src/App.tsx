import { Suspense, type ReactNode } from "react";
import { Routes, Route } from "react-router-dom";
import { LoginPage } from "./features/auth/LoginPage";
import { RegisterPage } from "./features/auth/RegisterPage";
import { ForgotPasswordPage } from "./features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./features/auth/ResetPasswordPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { PlayGamePage } from "./features/games/PlayGamePage";
import { FriendsPage } from "./features/friends/FriendsPage";
import { ProfilePage } from "./features/profile/ProfilePage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { ProtectedRoute } from "./features/layout/ProtectedRoute";
import { AppShell } from "./features/layout/AppShell";
import { AdminRoute } from "./features/admin/AdminRoute";
import { AdminLayout } from "./features/admin/AdminLayout";
import { PageLoading } from "./features/layout/PageLoading";
import { lazyPage } from "./lib/lazy-page";

// Admin pages are a separate chunk: most players never open them.
const OverviewPage = lazyPage(() => import("./features/admin/OverviewPage"), "OverviewPage");
const PuzzlesPage = lazyPage(() => import("./features/admin/PuzzlesPage"), "PuzzlesPage");
const GamesPage = lazyPage(() => import("./features/admin/GamesPage"), "GamesPage");
const UsersPage = lazyPage(() => import("./features/admin/UsersPage"), "UsersPage");

function AdminPage({ children }: { children: ReactNode }) {
  return (
    <AdminRoute>
      <AdminLayout>
        <Suspense fallback={<PageLoading />}>{children}</Suspense>
      </AdminLayout>
    </AdminRoute>
  );
}
import { NotFoundPage } from "./features/layout/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/play/:slug" element={<PlayGamePage />} />
                <Route path="/friends" element={<FriendsPage />} />
                <Route path="/u/:username" element={<ProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route
                  path="/admin"
                  element={
                    <AdminPage>
                      <OverviewPage />
                    </AdminPage>
                  }
                />
                <Route
                  path="/admin/puzzles"
                  element={
                    <AdminPage>
                      <PuzzlesPage />
                    </AdminPage>
                  }
                />
                <Route
                  path="/admin/games"
                  element={
                    <AdminPage>
                      <GamesPage />
                    </AdminPage>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <AdminPage>
                      <UsersPage />
                    </AdminPage>
                  }
                />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
