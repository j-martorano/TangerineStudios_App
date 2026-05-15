import Image from "next/image";
import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex justify-center">
          <Image
            src="/branding/Logo_Y_Texto_Transparente.png"
            alt="Tangerine Studios"
            width={240}
            height={56}
            priority
            unoptimized
            className="h-12 w-auto object-contain"
          />
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
