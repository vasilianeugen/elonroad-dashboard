import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Shield, User, Loader2, Pencil, Check, X, KeyRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import elonroadLogo from "@/assets/elonroad-logo.png";

interface ManagedUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  display_name: string | null;
  roles: string[];
}

const Admin = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  // New user form
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState<string>("user");
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await supabase.functions.invoke("admin-users", {
        method: "GET",
      });
      if (resp.error) throw resp.error;
      setUsers(resp.data.users || []);
    } catch (err: any) {
      toast({
        title: t("admin.error"),
        description: err.message || "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async () => {
    if (!newEmail || !isPasswordValid(newPassword)) return;
    setCreating(true);
    try {
      const resp = await supabase.functions.invoke("admin-users", {
        method: "POST",
        body: {
          email: newEmail,
          password: newPassword,
          display_name: newDisplayName,
          role: newRole,
        },
      });
      if (resp.error) throw resp.error;
      toast({ title: t("admin.userCreated") });
      setDialogOpen(false);
      setNewEmail("");
      setNewPassword("");
      setNewDisplayName("");
      setNewRole("user");
      fetchUsers();
    } catch (err: any) {
      toast({
        title: t("admin.error"),
        description: err.message || "Failed to create user",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const resp = await supabase.functions.invoke(`admin-users?userId=${userId}`, {
        method: "DELETE",
      });
      if (resp.error) throw resp.error;
      toast({ title: t("admin.userDeleted") });
      setDeleteUserId(null);
      fetchUsers();
    } catch (err: any) {
      toast({
        title: t("admin.error"),
        description: err.message || "Failed to delete user",
        variant: "destructive",
      });
    }
  };

  const handleUpdateDisplayName = async (userId: string) => {
    try {
      const resp = await supabase.functions.invoke("admin-users", {
        method: "PATCH",
        body: { userId, display_name: editNameValue },
      });
      if (resp.error) throw resp.error;
      toast({ title: t("admin.nameUpdated") });
      setEditingNameId(null);
      fetchUsers();
    } catch (err: any) {
      toast({
        title: t("admin.error"),
        description: err.message || "Failed to update name",
        variant: "destructive",
      });
    }
  };

  const isPasswordValid = (pw: string) => {
    return pw.length >= 8 &&
      /[A-Z]/.test(pw) &&
      /[a-z]/.test(pw) &&
      /[0-9]/.test(pw) &&
      /[^A-Za-z0-9]/.test(pw);
  };

  const handleResetPassword = async (userId: string) => {
    if (!isPasswordValid(resetPassword)) {
      toast({ title: t("admin.error"), description: t("admin.passwordTooShort"), variant: "destructive" });
      return;
    }
    setResetting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("No active session");
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action: "reset_password", userId, newPassword: resetPassword }),
        }
      );
      const resp = await response.json();
      if (!response.ok) throw new Error(resp.error || "Failed to reset password");
      toast({ title: t("admin.passwordReset") });
      setResetPasswordUserId(null);
      setResetPassword("");
    } catch (err: any) {
      toast({ title: t("admin.error"), description: err.message || "Failed to reset password", variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      const resp = await supabase.functions.invoke("admin-users", {
        method: "PATCH",
        body: { userId, role: newRole },
      });
      if (resp.error) throw resp.error;
      toast({ title: t("admin.roleUpdated") });
      fetchUsers();
    } catch (err: any) {
      toast({
        title: t("admin.error"),
        description: err.message || "Failed to update role",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <img src={elonroadLogo} alt="Elonroad" className="h-6 sm:h-8 w-auto" />
            <h1 className="text-lg font-bold text-foreground">{t("admin.title")}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl">{t("admin.usersTitle")}</CardTitle>
              <CardDescription>{t("admin.usersDescription")}</CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="w-4 h-4" />
                  {t("admin.addUser")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("admin.addUser")}</DialogTitle>
                  <DialogDescription>{t("admin.addUserDescription")}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <label className="text-sm font-medium text-foreground">{t("login.email")}</label>
                    <Input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="user@example.com"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">{t("login.password")}</label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">{t("admin.displayName")}</label>
                    <Input
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">{t("admin.role")}</label>
                    <Select value={newRole} onValueChange={setNewRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreateUser} disabled={creating || !newEmail || !isPasswordValid(newPassword)}>
                    {creating && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                    {t("admin.create")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("login.email")}</TableHead>
                    <TableHead>{t("admin.displayName")}</TableHead>
                    <TableHead>{t("admin.role")}</TableHead>
                    <TableHead>{t("admin.lastSignIn")}</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell>
                        {editingNameId === u.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editNameValue}
                              onChange={(e) => setEditNameValue(e.target.value)}
                              className="h-8 w-[140px]"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleUpdateDisplayName(u.id);
                                if (e.key === "Escape") setEditingNameId(null);
                              }}
                            />
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleUpdateDisplayName(u.id)}>
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingNameId(null)}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 group">
                            <span>{u.display_name || "—"}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => { setEditingNameId(u.id); setEditNameValue(u.display_name || ""); }}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.id === currentUser?.id ? (
                          <Badge variant="default">
                            <Shield className="w-3 h-3 mr-1" />
                            admin
                          </Badge>
                        ) : (
                          <Select
                            value={u.roles[0] || "user"}
                            onValueChange={(value) => handleChangeRole(u.id, value)}
                          >
                            <SelectTrigger className="w-[110px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {u.last_sign_in_at
                          ? new Date(u.last_sign_in_at).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Dialog
                            open={resetPasswordUserId === u.id}
                            onOpenChange={(open) => { setResetPasswordUserId(open ? u.id : null); setResetPassword(""); }}
                          >
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <KeyRound className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>{t("admin.resetPassword")}</DialogTitle>
                                <DialogDescription>
                                  {t("admin.resetPasswordDescription").replace("{email}", u.email || "")}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="py-2">
                                <label className="text-sm font-medium text-foreground">{t("admin.newPassword")}</label>
                                <Input
                                  type="password"
                                  value={resetPassword}
                                  onChange={(e) => setResetPassword(e.target.value)}
                                  placeholder="••••••••"
                                />
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setResetPasswordUserId(null)}>
                                  {t("admin.cancel")}
                                </Button>
                                <Button onClick={() => handleResetPassword(u.id)} disabled={resetting || !isPasswordValid(resetPassword)}>
                                  {resetting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                                  {t("admin.resetPassword")}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                          <Dialog
                            open={deleteUserId === u.id}
                            onOpenChange={(open) => setDeleteUserId(open ? u.id : null)}
                          >
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>{t("admin.confirmDelete")}</DialogTitle>
                                <DialogDescription>
                                  {t("admin.confirmDeleteDescription").replace("{email}", u.email || "")}
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setDeleteUserId(null)}>
                                  {t("admin.cancel")}
                                </Button>
                                <Button variant="destructive" onClick={() => handleDeleteUser(u.id)}>
                                  {t("admin.delete")}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Admin;
