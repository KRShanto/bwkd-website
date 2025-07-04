"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import { createUser, type CreateUserData } from "@/actions/create-user";
import { deleteUser } from "@/actions/delete-user";
import { PROFILES_TABLE, BRANCHES_TABLE } from "@/lib/supabase-constants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Users,
  Search,
  Edit,
  Trash2,
  UserPlus,
  Filter,
  MoreHorizontal,
  Shield,
  Eye,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  mother_name: string;
  father_name: string;
  profile_image_url: string;
  current_belt: string;
  current_dan: number;
  weight: number;
  gender: string;
  branch: number | null;
  auth_id: string;
  role: "student" | "trainer";
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

interface Branch {
  id: number;
  name: string;
  created_at: string;
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Initial state for new user
  const initialNewUser = {
    name: "",
    email: "",
    phone: "",
    mother_name: "",
    father_name: "",
    profile_image_url: "",
    current_belt: "white",
    current_dan: 1,
    weight: 0,
    gender: "male",
    branch: null, // No branch assigned by default
    role: "student" as "student" | "trainer",
    is_admin: false,
    password: "",
  };

  const [newUser, setNewUser] = useState<typeof initialNewUser>(initialNewUser);

  // Fetch branches from Supabase
  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from(BRANCHES_TABLE)
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;

      setBranches(data || []);
    } catch (error) {
      console.error("Error fetching branches:", error);
      toast.error("Failed to load branches");
    }
  };

  // Fetch users from Supabase
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from(PROFILES_TABLE)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchBranches();
  }, []);

  // Handle image upload
  const uploadImage = async (file: File): Promise<string> => {
    try {
      setImageUploading(true);

      // Generate unique filename
      const timestamp = new Date().getTime();
      const fileExt = file.name.split(".").pop();
      const fileName = `${timestamp}-${Math.random()
        .toString(36)
        .substring(2)}.${fileExt}`;

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from("profile-images")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("profile-images").getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    } finally {
      setImageUploading(false);
    }
  };

  // Handle image file selection
  const handleImageChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    isEdit: boolean = false
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    try {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload image
      const imageUrl = await uploadImage(file);

      if (isEdit && selectedUser) {
        handleEditInputChange("profile_image_url", imageUrl);
      } else {
        handleCreateInputChange("profile_image_url", imageUrl);
      }

      toast.success("Image uploaded successfully");
    } catch (error) {
      console.error("Error handling image:", error);
      toast.error("Failed to upload image");
      setImagePreview(null);
    }
  };

  // Filter users based on search and role filter
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Handle edit user
  const handleEditUser = async () => {
    if (!selectedUser) return;

    try {
      setEditLoading(true);

      const { error } = await supabase
        .from(PROFILES_TABLE)
        .update({
          name: selectedUser.name,
          email: selectedUser.email,
          phone: selectedUser.phone,
          role: selectedUser.role,
          is_admin: selectedUser.is_admin,
          current_belt: selectedUser.current_belt,
          current_dan: selectedUser.current_dan,
          weight: selectedUser.weight,
          gender: selectedUser.gender,
          branch: selectedUser.branch,
          profile_image_url: selectedUser.profile_image_url,
        })
        .eq("id", selectedUser.id);

      if (error) throw error;

      // Update local state
      setUsers(users.map((u) => (u.id === selectedUser.id ? selectedUser : u)));
      setEditDialogOpen(false);
      setSelectedUser(null);

      toast.success("User updated successfully");
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user");
    } finally {
      setEditLoading(false);
    }
  };

  // Handle delete user
  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    // Prevent admin from deleting themselves
    if (selectedUser.auth_id === currentUser?.email?.replace("@bwkd.app", "")) {
      toast.error("You cannot delete your own account");
      return;
    }

    try {
      setDeleteLoading(true);

      // Call server action to delete user from both Auth and profiles
      const result = await deleteUser(selectedUser.id, selectedUser.auth_id);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      // Remove from local state
      setUsers(users.filter((u) => u.id !== selectedUser.id));
      setDeleteDialogOpen(false);
      setSelectedUser(null);

      toast.success("User deleted successfully from both Auth and profile");
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Handle create user
  const handleCreateUser = async () => {
    try {
      setCreateLoading(true);

      // Prepare user data for server action
      const userData: CreateUserData = {
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        phone: newUser.phone,
        mother_name: newUser.mother_name,
        father_name: newUser.father_name,
        profile_image_url: newUser.profile_image_url,
        current_belt: newUser.current_belt,
        current_dan: newUser.current_dan,
        weight: newUser.weight,
        gender: newUser.gender,
        branch: newUser.branch,
        role: newUser.role,
        is_admin: newUser.is_admin,
      };

      // Call server action to create user
      const result = await createUser(userData);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      // Add to local state
      const newUserRecord: User = result.user;
      setUsers([newUserRecord, ...users]);
      setCreateDialogOpen(false);
      setNewUser(initialNewUser);
      setImagePreview(null);

      toast.success("User created successfully");
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Failed to create user");
    } finally {
      setCreateLoading(false);
    }
  };

  // Handle input changes for edit form
  const handleEditInputChange = (field: keyof User, value: any) => {
    if (selectedUser) {
      setSelectedUser({ ...selectedUser, [field]: value });
    }
  };

  // Handle input changes for create form
  const handleCreateInputChange = (field: string, value: any) => {
    setNewUser({ ...newUser, [field]: value });
  };

  // Get branch name by ID
  const getBranchName = (branchId: number | null) => {
    if (branchId === null) return "No Branch";
    const branch = branches.find((b) => b.id === branchId);
    return branch ? branch.name : "Unknown Branch";
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Get belt color for display
  const getBeltColor = (belt: string) => {
    const colors: { [key: string]: string } = {
      white: "bg-gray-100 text-gray-800",
      yellow: "bg-yellow-100 text-yellow-800",
      orange: "bg-orange-100 text-orange-800",
      "green-junior": "bg-green-100 text-green-800",
      "green-senior": "bg-green-200 text-green-900",
      "blue-junior": "bg-blue-100 text-blue-800",
      "blue-senior": "bg-blue-200 text-blue-900",
      "brown-junior": "bg-amber-100 text-amber-800",
      "brown-senior": "bg-amber-200 text-amber-900",
      "black-belt": "bg-gray-900 text-white",
    };
    return colors[belt] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            User Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage users, roles, and permissions
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-sm">
            {filteredUsers.length} users
          </Badge>
          <Button
            onClick={() => {
              setCreateDialogOpen(true);
              setImagePreview(null);
            }}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Create User
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="w-5 h-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Users</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="search"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <Label htmlFor="role-filter">Filter by Role</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger id="role-filter">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="student">Students</SelectItem>
                  <SelectItem value="trainer">Trainers</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>All Users</span>
          </CardTitle>
          <CardDescription>
            View and manage all registered users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Belt</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            {user.profile_image_url ? (
                              <AvatarImage
                                src={user.profile_image_url}
                                alt={user.name}
                              />
                            ) : (
                              <AvatarFallback>
                                {user.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div>
                            <div className="font-medium flex items-center space-x-2">
                              <span>{user.name}</span>
                              {user.is_admin && (
                                <span title="Administrator">
                                  <Shield className="w-4 h-4 text-red-500" />
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              {user.gender === "male" ? "Male" : "Female"} •{" "}
                              {user.weight}kg
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.role === "trainer" ? "default" : "secondary"
                          }
                        >
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "text-xs",
                            getBeltColor(user.current_belt)
                          )}
                        >
                          {user.current_belt.replace("-", " ")}
                          {user.current_belt === "black-belt" &&
                            user.current_dan > 1 && (
                              <span className="ml-1">
                                ({user.current_dan} Dan)
                              </span>
                            )}
                        </Badge>
                      </TableCell>
                      <TableCell>{getBranchName(user.branch)}</TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDate(user.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setEditDialogOpen(true);
                              setImagePreview(null);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setDeleteDialogOpen(true);
                            }}
                            disabled={
                              user.auth_id ===
                              currentUser?.email?.replace("@bwkd.app", "")
                            }
                            className="text-red-500 hover:text-red-700 disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredUsers.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-500">
                  No users found matching your criteria.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setImagePreview(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and permissions
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4 max-h-96 overflow-y-auto px-2 py-2">
              {/* Profile Image Upload */}
              <div className="space-y-2">
                <Label>Profile Image</Label>
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <Avatar className="h-20 w-20">
                      {imagePreview || selectedUser.profile_image_url ? (
                        <AvatarImage
                          src={imagePreview || selectedUser.profile_image_url}
                          alt={selectedUser.name}
                        />
                      ) : (
                        <AvatarFallback>
                          {selectedUser.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    {imageUploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full">
                        <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          document.getElementById("edit-image-upload")?.click()
                        }
                        disabled={imageUploading}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {imageUploading ? "Uploading..." : "Upload Image"}
                      </Button>
                      {(imagePreview || selectedUser.profile_image_url) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setImagePreview(null);
                            handleEditInputChange("profile_image_url", "");
                          }}
                          disabled={imageUploading}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <input
                      id="edit-image-upload"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageChange(e, true)}
                      className="hidden"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      JPG, PNG or WebP. Max size 5MB.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-name">Name</Label>
                  <Input
                    id="edit-name"
                    value={selectedUser.name}
                    onChange={(e) =>
                      handleEditInputChange("name", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    value={selectedUser.email}
                    onChange={(e) =>
                      handleEditInputChange("email", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    value={selectedUser.phone}
                    onChange={(e) =>
                      handleEditInputChange("phone", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit-branch">Branch</Label>
                  <Select
                    value={selectedUser.branch?.toString() || "none"}
                    onValueChange={(value) =>
                      handleEditInputChange(
                        "branch",
                        value === "none" ? null : parseInt(value)
                      )
                    }
                  >
                    <SelectTrigger id="edit-branch">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Branch</SelectItem>
                      {branches.map((branch) => (
                        <SelectItem
                          key={branch.id}
                          value={branch.id.toString()}
                        >
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-role">Role</Label>
                  <Select
                    value={selectedUser.role}
                    onValueChange={(value) =>
                      handleEditInputChange("role", value)
                    }
                  >
                    <SelectTrigger id="edit-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="trainer">Trainer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-belt">Current Belt</Label>
                  <Select
                    value={selectedUser.current_belt}
                    onValueChange={(value) =>
                      handleEditInputChange("current_belt", value)
                    }
                  >
                    <SelectTrigger id="edit-belt">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="white">White</SelectItem>
                      <SelectItem value="yellow">Yellow</SelectItem>
                      <SelectItem value="orange">Orange</SelectItem>
                      <SelectItem value="green-junior">Green Junior</SelectItem>
                      <SelectItem value="green-senior">Green Senior</SelectItem>
                      <SelectItem value="blue-junior">Blue Junior</SelectItem>
                      <SelectItem value="blue-senior">Blue Senior</SelectItem>
                      <SelectItem value="brown-junior">Brown Junior</SelectItem>
                      <SelectItem value="brown-senior">Brown Senior</SelectItem>
                      <SelectItem value="black-belt">Black Belt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedUser.current_belt === "black-belt" && (
                <div>
                  <Label htmlFor="edit-dan">Dan Level</Label>
                  <Select
                    value={selectedUser.current_dan.toString()}
                    onValueChange={(value) =>
                      handleEditInputChange("current_dan", parseInt(value))
                    }
                  >
                    <SelectTrigger id="edit-dan">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((dan) => (
                        <SelectItem key={dan} value={dan.toString()}>
                          {dan} Dan
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-admin"
                  checked={selectedUser.is_admin}
                  onChange={(e) =>
                    handleEditInputChange("is_admin", e.target.checked)
                  }
                  className="rounded"
                />
                <Label htmlFor="edit-admin">Administrator privileges</Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setImagePreview(null);
              }}
              disabled={editLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleEditUser} disabled={editLoading}>
              {editLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) setImagePreview(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Create a new user account with profile information
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-96 overflow-y-auto px-2 py-2">
            {/* Profile Image Upload */}
            <div className="space-y-2">
              <Label>Profile Image</Label>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Avatar className="h-20 w-20">
                    {imagePreview || newUser.profile_image_url ? (
                      <AvatarImage
                        src={imagePreview || newUser.profile_image_url}
                        alt="Preview"
                      />
                    ) : (
                      <AvatarFallback>
                        <Upload className="w-8 h-8 text-gray-400" />
                      </AvatarFallback>
                    )}
                  </Avatar>
                  {imageUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full">
                      <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        document.getElementById("create-image-upload")?.click()
                      }
                      disabled={imageUploading}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {imageUploading ? "Uploading..." : "Upload Image"}
                    </Button>
                    {(imagePreview || newUser.profile_image_url) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setImagePreview(null);
                          handleCreateInputChange("profile_image_url", "");
                        }}
                        disabled={imageUploading}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <input
                    id="create-image-upload"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e, false)}
                    className="hidden"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    JPG, PNG or WebP. Max size 5MB.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="create-name">
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="create-name"
                  value={newUser.name}
                  onChange={(e) =>
                    handleCreateInputChange("name", e.target.value)
                  }
                />
              </div>
              <div>
                <Label htmlFor="create-email">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="create-email"
                  value={newUser.email}
                  onChange={(e) =>
                    handleCreateInputChange("email", e.target.value)
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="create-password">
                  Password <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="create-password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) =>
                    handleCreateInputChange("password", e.target.value)
                  }
                />
              </div>
              <div>
                <Label htmlFor="create-phone">Phone</Label>
                <Input
                  id="create-phone"
                  value={newUser.phone}
                  onChange={(e) =>
                    handleCreateInputChange("phone", e.target.value)
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="create-father-name">Father's Name</Label>
                <Input
                  id="create-father-name"
                  value={newUser.father_name}
                  onChange={(e) =>
                    handleCreateInputChange("father_name", e.target.value)
                  }
                />
              </div>
              <div>
                <Label htmlFor="create-mother-name">Mother's Name</Label>
                <Input
                  id="create-mother-name"
                  value={newUser.mother_name}
                  onChange={(e) =>
                    handleCreateInputChange("mother_name", e.target.value)
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="create-branch">Branch</Label>
                <Select
                  value={
                    (newUser.branch as number | null)?.toString() || "none"
                  }
                  onValueChange={(value) =>
                    handleCreateInputChange(
                      "branch",
                      value === "none" ? null : parseInt(value)
                    )
                  }
                >
                  <SelectTrigger id="create-branch">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Branch</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id.toString()}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="create-weight">Weight (kg)</Label>
                <Input
                  id="create-weight"
                  type="number"
                  value={newUser.weight}
                  onChange={(e) =>
                    handleCreateInputChange(
                      "weight",
                      parseInt(e.target.value) || 0
                    )
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="create-gender">Gender</Label>
                <Select
                  value={newUser.gender}
                  onValueChange={(value) =>
                    handleCreateInputChange("gender", value)
                  }
                >
                  <SelectTrigger id="create-gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="create-role">Role</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value) =>
                    handleCreateInputChange("role", value)
                  }
                >
                  <SelectTrigger id="create-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="trainer">Trainer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="create-belt">Current Belt</Label>
                <Select
                  value={newUser.current_belt}
                  onValueChange={(value) =>
                    handleCreateInputChange("current_belt", value)
                  }
                >
                  <SelectTrigger id="create-belt">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="white">White</SelectItem>
                    <SelectItem value="yellow">Yellow</SelectItem>
                    <SelectItem value="orange">Orange</SelectItem>
                    <SelectItem value="green-junior">Green Junior</SelectItem>
                    <SelectItem value="green-senior">Green Senior</SelectItem>
                    <SelectItem value="blue-junior">Blue Junior</SelectItem>
                    <SelectItem value="blue-senior">Blue Senior</SelectItem>
                    <SelectItem value="brown-junior">Brown Junior</SelectItem>
                    <SelectItem value="brown-senior">Brown Senior</SelectItem>
                    <SelectItem value="black-belt">Black Belt</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newUser.current_belt === "black-belt" && (
                <div>
                  <Label htmlFor="create-dan">Dan Level</Label>
                  <Select
                    value={newUser.current_dan.toString()}
                    onValueChange={(value) =>
                      handleCreateInputChange("current_dan", parseInt(value))
                    }
                  >
                    <SelectTrigger id="create-dan">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((dan) => (
                        <SelectItem key={dan} value={dan.toString()}>
                          {dan} Dan
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="create-admin"
                checked={newUser.is_admin}
                onChange={(e) =>
                  handleCreateInputChange("is_admin", e.target.checked)
                }
                className="rounded"
              />
              <Label htmlFor="create-admin">Administrator privileges</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setNewUser(initialNewUser);
                setImagePreview(null);
              }}
              disabled={createLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateUser} disabled={createLoading}>
              {createLoading ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedUser?.name}? This action
              cannot be undone. All user data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteLoading ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
