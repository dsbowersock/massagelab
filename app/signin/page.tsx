import { Button } from "@/components/ui/button"
import { Github } from 'lucide-react'
import Image from "next/image"

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="content-container max-w-md mx-auto bg-[#2d2d2d] p-6 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold mb-6">Welcome to MassageLab</h1>
          <p className="text-muted-foreground mb-6">
            Sign in to access personalized features and save your preferences.
          </p>
          <div className="flex flex-col gap-4">
            <form
              action={async () => {
                "use server"
                const { signIn } = await import("@/auth")
                await signIn("github", { redirectTo: "/" })
              }}
            >
              <Button type="submit" className="w-full bg-[#24292F] hover:bg-[#24292F]/90">
                <Github className="mr-2 h-4 w-4" />
                Sign in with GitHub
              </Button>
            </form>
            
            <form
              action={async () => {
                "use server"
                const { signIn } = await import("@/auth")
                await signIn("google", { redirectTo: "/" })
              }}
            >
              <Button type="submit" className="w-full bg-white text-gray-900 hover:bg-gray-100">
                <div className="flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Sign in with Google
                </div>
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

