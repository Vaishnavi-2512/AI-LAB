import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

// UI
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Shield } from "lucide-react";

// 🔥 Firebase
import { auth, db } from "../firebaseConfig";
import { createUserWithEmailAndPassword, AuthError } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

// ─────────────────────────────────────────────────────────────
// Hard-coded Admin Accounts (loginId → { email, password, name })
const ADMIN_ACCOUNTS: Record<
  string,
  { email: string; password: string; name: string }
> = {
  A0001: { email: "venkatesh@eee.sastra.edu", password: "admin1", name: "T. Venkatesh" },
  A0002: { email: "126179012@sastra.ac.in", password: "admin2", name: "Karthikeya" },
  A0003: { email: "126179030@sastra.ac.in", password: "admin3", name: "Vaishnavi" },
};
// ─────────────────────────────────────────────────────────────

type Role = "STUDENT" | "FACULTY" | "ADMIN";

const SignupComplete = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");          // used for Firebase Auth (except admin)
  const [loginId, setLoginId] = useState("");      // used across the app
  const [role, setRole] = useState<Role>("STUDENT");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // UI state
  const [creating, setCreating] = useState(false);
  const [done, setDone] = useState(false);

  // If the loginId matches an admin, we’ll force credentials + role
  const adminPreset = useMemo(() => ADMIN_ACCOUNTS[loginId] || null, [loginId]);
  const isAdminLoginId = !!adminPreset;

  const validate = () => {
    if (!name || !loginId) {
      toast({ variant: "destructive", title: "Missing fields", description: "Name and Login ID are required." });
      return false;
    }

    // For normal users, validate email/password inputs.
    if (!isAdminLoginId) {
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        toast({ variant: "destructive", title: "Invalid email", description: "Please enter a valid email address." });
        return false;
      }
      if (!password || password.length < 8) {
        toast({ variant: "destructive", title: "Weak password", description: "Password must be at least 8 characters." });
        return false;
      }
      if (password !== confirmPassword) {
        toast({ variant: "destructive", title: "Password mismatch", description: "Passwords do not match." });
        return false;
      }
    } else {
      // For admin IDs, we’ll use predefined email/password — just ensure name is set.
      if (!adminPreset?.email || !adminPreset?.password) {
        toast({ variant: "destructive", title: "Admin preset missing", description: "Contact the developer." });
        return false;
      }
    }
    return true;
  };

  const handleSignup = async () => {
    if (!validate()) return;

    setCreating(true);
    try {
      // 1) Ensure loginId is unique via loginLookup/{loginId}
      const lookupRef = doc(db, "loginLookup", loginId);
      const lookupSnap = await getDoc(lookupRef);
      if (lookupSnap.exists()) {
        toast({
          variant: "destructive",
          title: "Login ID in use",
          description: `The Login ID "${loginId}" is already taken.`,
        });
        setCreating(false);
        return;
      }

      // 2) Choose credentials & role
      let accountEmail = email;
      let accountPassword = password;
      let accountRole: Role = role;
      let accountName = name;

      if (isAdminLoginId) {
        accountEmail = adminPreset!.email;
        accountPassword = adminPreset!.password;
        accountRole = "ADMIN";
        // If you want to force the admin display name from preset, uncomment next line:
        accountName = adminPreset!.name || name || "Admin";
      }

      // 3) Create Auth user (this signs the user in)
      const cred = await createUserWithEmailAndPassword(auth, accountEmail, accountPassword);
      const uid = cred.user?.uid;

      // 4) Write profile in Firestore: users/{uid}
      await setDoc(
        doc(db, "users", uid),
        {
          uid,
          name: accountName,
          email: accountEmail,
          loginId,
          role: accountRole, // "STUDENT" | "FACULTY" | "ADMIN"
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 5) Write login lookup mapping: loginLookup/{loginId} -> { email, uid }
      await setDoc(lookupRef, { email: accountEmail, uid });

      // 6) Persist session info for your app
      localStorage.setItem("loginId", loginId);
      localStorage.setItem("role", accountRole);
      localStorage.setItem("name", accountName);
      localStorage.setItem("email", accountEmail);

      toast({ title: "Account created", description: isAdminLoginId ? "Admin account created." : "You can now log in with your Login ID and password." });
      setDone(true);
    } catch (e: any) {
      const code = (e as AuthError)?.code || "";
      console.error("[Signup] failed", e);

      if (code.includes("auth/email-already-in-use")) {
        toast({
          variant: "destructive",
          title: "Email already in use",
          description: "Try logging in, or use a different email address.",
        });
      } else if (code.includes("auth/invalid-email")) {
        toast({
          variant: "destructive",
          title: "Invalid email",
          description: "Please enter a valid email address.",
        });
      } else if (code.includes("auth/operation-not-allowed")) {
        toast({
          variant: "destructive",
          title: "Enable Email/Password",
          description: "In Firebase Console → Authentication → Sign-in method, enable Email/Password.",
        });
      } else if (code.includes("auth/weak-password")) {
        toast({
          variant: "destructive",
          title: "Weak password",
          description: "Password should be at least 8 characters.",
        });
      } else {
        // Firestore rule errors also land here if setDoc fails
        toast({
          variant: "destructive",
          title: "Sign up failed",
          description: e?.message || "Could not create your account.",
        });
      }
    } finally {
      setCreating(false);
    }
  };

  const goLogin = () => navigate("/auth");

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader className="text-center">
                <CheckCircle className="h-12 w-12 text-success mx-auto mb-3" />
                <CardTitle className="text-2xl text-success">Account Created!</CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <p><strong>Login ID:</strong> {loginId}</p>
                <p><strong>Email:</strong> {isAdminLoginId ? ADMIN_ACCOUNTS[loginId].email : email}</p>
                <Button className="w-full" onClick={goLogin}>Go to Login</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Create your account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Admin banner if loginId matches */}
              {isAdminLoginId && (
                <div className="flex items-start gap-3 p-3 border rounded-md bg-amber-50 text-amber-900">
                  <Shield className="h-5 w-5 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-medium">Admin Login ID detected</div>
                    <div>
                      Email & password inputs will be ignored and replaced with:
                      <div className="mt-1">
                        <code>{ADMIN_ACCOUNTS[loginId].email}</code> / <code>{ADMIN_ACCOUNTS[loginId].password}</code>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label>Full Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>

              <div>
                <Label>Login ID</Label>
                <Input value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="S123456789 / F1234 / A0001" />
              </div>

              {/* Email/Password shown, but ignored for admin preset */}
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={isAdminLoginId ? ADMIN_ACCOUNTS[loginId].email : email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={isAdminLoginId}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={isAdminLoginId ? ADMIN_ACCOUNTS[loginId].password : password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    disabled={isAdminLoginId}
                  />
                </div>
                <div>
                  <Label>Confirm Password</Label>
                  <Input
                    type="password"
                    value={isAdminLoginId ? ADMIN_ACCOUNTS[loginId].password : confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    disabled={isAdminLoginId}
                  />
                </div>
              </div>

              {/* Role selector hidden/disabled for admin */}
              <div>
                <Label>Role</Label>
                <div className="flex gap-3 mt-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="role"
                      value="STUDENT"
                      checked={isAdminLoginId ? false : role === "STUDENT"}
                      onChange={() => setRole("STUDENT")}
                      disabled={isAdminLoginId}
                    />
                    Student
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="role"
                      value="FACULTY"
                      checked={isAdminLoginId ? false : role === "FACULTY"}
                      onChange={() => setRole("FACULTY")}
                      disabled={isAdminLoginId}
                    />
                    Faculty
                  </label>
                  <label className="flex items-center gap-2 text-sm opacity-70">
                    <input type="radio" name="role" value="ADMIN" checked={isAdminLoginId} readOnly />
                    Admin
                  </label>
                </div>
              </div>

              <Button className="w-full" onClick={handleSignup} disabled={creating}>
                {creating ? "Creating…" : "Create Account"}
              </Button>

              <p className="text-sm text-muted-foreground text-center mt-4">
                Already have an account?{" "}
                <button className="underline" onClick={goLogin}>
                  Log in
                </button>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SignupComplete;
