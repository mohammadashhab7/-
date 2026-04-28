import { SignIn } from "@clerk/react";

export default function SignInPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center py-12 px-4">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        afterSignInUrl="/"
        afterSignUpUrl="/"
      />
    </div>
  );
}
