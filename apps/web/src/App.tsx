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
import { OverviewPage } from "./features/admin/OverviewPage";
import { PuzzlesPage } from "./features/admin/PuzzlesPage";
import { GamesPage } from "./features/admin/GamesPage";
import { UsersPage } from "./features/admin/UsersPage";
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
                    <AdminRoute>
                      <AdminLayout>
                        <OverviewPage />
                      </AdminLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/puzzles"
                  element={
                    <AdminRoute>
                      <AdminLayout>
                        <PuzzlesPage />
                      </AdminLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/games"
                  element={
                    <AdminRoute>
                      <AdminLayout>
                        <GamesPage />
                      </AdminLayout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <AdminRoute>
                      <AdminLayout>
                        <UsersPage />
                      </AdminLayout>
                    </AdminRoute>
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
