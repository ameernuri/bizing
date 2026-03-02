import { redirect } from 'next/navigation'

export default async function OodaSubpathRedirect({
  params,
}: {
  params: Promise<{ slug: string[] }>
}) {
  const { slug } = await params
  const nextPath = slug?.length ? `/sagas/${slug.join('/')}` : '/sagas'
  redirect(nextPath)
}

