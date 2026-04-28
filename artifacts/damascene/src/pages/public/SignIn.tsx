import { SignIn } from "@clerk/react";
import { useGetBootstrapStatus } from "@workspace/api-client-react";

export default function SignInPage() {
  const { data: bootstrap } = useGetBootstrapStatus();
  const showBootstrapBanner = bootstrap && !bootstrap.hasOwner;
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center py-12 px-4 gap-6">
      {showBootstrapBanner && (
        <div
          className="max-w-lg w-full rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-foreground"
          data-testid="banner-bootstrap"
        >
          <p className="font-medium mb-1">إعداد المسؤول الأعلى</p>
          <p className="text-foreground/80">{bootstrap.bootstrapMessageAr}</p>
        </div>
      )}
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/"
      />
    </div>
  );
}
