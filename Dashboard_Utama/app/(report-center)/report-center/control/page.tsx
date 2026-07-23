import ControlRoomClient from './ControlRoomClient'

export const dynamic = 'force-dynamic'

type ReportSource = 'estate' | 'pabrik'

type PageProps = {
  searchParams?: Promise<{ source?: string }>
}

function normalizeSource(value?: string): ReportSource {
  return value === 'pabrik' ? 'pabrik' : 'estate'
}

export default async function ControlRoomPage({ searchParams }: PageProps) {
  const query = await searchParams
  const source = normalizeSource(query?.source)

  return <ControlRoomClient source={source} />
}
