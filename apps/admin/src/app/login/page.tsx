import { redirect } from 'next/navigation'

export default function LoginRedirectPage() {
  redirect('/sign-in')
}
