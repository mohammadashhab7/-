import { SignUp } from "@clerk/react";

export default function SignUpPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center py-12 px-4">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/"
      />
    </div>
  );
}
