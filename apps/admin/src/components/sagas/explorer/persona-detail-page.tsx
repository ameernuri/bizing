'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { sagaApi, type SagaLibraryRelations, type SagaPersonaDetail, type SagaRunSummary } from '@/lib/sagas-api'
import { EntitySummaryCard, getLatestRun, LifecycleBadge, LoadError, LoadingGrid, PageIntro, RunStatusBadge, summarizeRuns } from './common'

export function SagaPersonaDetailPage({ personaKey }: { personaKey: string }) {
  const [detail, setDetail] = useState<SagaPersonaDetail | null>(null)
  const [relations, setRelations] = useState<SagaLibraryRelations | null>(null)
  const [runs, setRuns] = useState<SagaRunSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setIsLoading(true)
    setError(null)
    try {
      const [nextDetail, nextRelations, allRuns] = await Promise.all([
        sagaApi.fetchPersonaDetail(personaKey),
        sagaApi.fetchLibraryRelations('persona', personaKey),
        sagaApi.fetchRuns({ limit: 5000, mineOnly: false, includeArchived: true }),
      ])
      setDetail(nextDetail)
      setRelations(nextRelations)
      const linkedKeys = new Set(nextRelations.definitions.map((definition) => definition.sagaKey))
      setRuns(allRuns.filter((run) => linkedKeys.has(run.sagaKey)))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load persona detail.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [personaKey])

  const currentVersion = useMemo(
    () => detail?.versions.find((version) => version.isCurrent) ?? detail?.versions[0] ?? null,
    [detail],
  )

  const definitionSummaries = useMemo(() => {
    return (relations?.definitions ?? []).map((definition) => {
      const definitionRuns = runs.filter((run) => run.sagaKey === definition.sagaKey)
      return {
        definition,
        definitionRuns,
        latestRun: getLatestRun(definitionRuns),
        runSummary: summarizeRuns(definitionRuns),
      }
    })
  }, [relations, runs])

  return (
    <div className="flex flex-1 flex-col">
      <PageIntro
        eyebrow="Persona"
        title={detail ? `${detail.definition.personaKey} · ${detail.definition.name}` : personaKey}
        description={detail?.definition.profileSummary ?? 'Open the linked saga definitions below to see how this persona pressures the API and schema from its own angle.'}
        actions={
          <Button variant="outline" asChild>
            <Link href="/sagas/personas">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to personas
            </Link>
          </Button>
        }
      />
      <div className="flex-1 p-6">
        {error ? <LoadError message={error} onRetry={() => void load()} /> : null}
        {isLoading || !detail || !relations ? (
          <LoadingGrid count={6} />
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>Current persona profile</CardTitle>
                    <LifecycleBadge status={detail.definition.status} />
                  </div>
                  <CardDescription>
                    The current persona description explains the intent, pressure points, and expected behavior this actor brings into saga runs.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm leading-6">
                  <div className="rounded-lg border p-4 whitespace-pre-wrap">{currentVersion?.bodyMarkdown ?? currentVersion?.profile ?? 'No current persona body is available.'}</div>
                  {currentVersion?.goals ? (
                    <div className="rounded-lg border p-4 whitespace-pre-wrap">
                      <p className="mb-2 font-medium">Goals</p>
                      <p>{currentVersion.goals}</p>
                    </div>
                  ) : null}
                  {currentVersion?.painPoints ? (
                    <div className="rounded-lg border p-4 whitespace-pre-wrap">
                      <p className="mb-2 font-medium">Pain points</p>
                      <p>{currentVersion.painPoints}</p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Linked saga coverage</CardTitle>
                  <CardDescription>
                    These numbers show how many definitions and runs currently use this persona to test the platform.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded-lg border p-4">
                    <p className="text-2xl font-semibold">{relations.definitions.length}</p>
                    <p className="text-muted-foreground">linked saga definitions</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-2xl font-semibold">{runs.length}</p>
                    <p className="text-muted-foreground">runs connected to those definitions</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-2xl font-semibold">{definitionSummaries.filter((entry) => entry.latestRun?.status === 'passed').length}</p>
                    <p className="text-muted-foreground">definitions whose latest run is green</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Version history</CardTitle>
                <CardDescription>Old persona versions matter when earlier saga definitions still reflect a previous testing style.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {detail.versions.map((version, index) => (
                  <div key={version.id} className="space-y-3">
                    {index > 0 ? <Separator /> : null}
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">v{version.versionNumber} · {version.name}</p>
                        <p className="text-sm text-muted-foreground">{version.profile ?? 'No profile summary attached.'}</p>
                      </div>
                      {version.isCurrent ? <LifecycleBadge status="active" /> : null}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Linked saga definitions</CardTitle>
                <CardDescription>Open a linked definition to see the exact lifecycle steps this persona participates in.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {definitionSummaries.map(({ definition, latestRun, runSummary }) => (
                    <EntitySummaryCard
                      key={definition.id}
                      href={`/sagas/definitions/${encodeURIComponent(definition.sagaKey)}`}
                      title={definition.title}
                      description={definition.description}
                      status={latestRun ? <RunStatusBadge status={latestRun.status} /> : <LifecycleBadge status={definition.status} />}
                      footer={
                        <div className="space-y-1">
                          <p>{definition.sagaKey}</p>
                          <p>{runSummary.passed}/{runSummary.total} runs passed</p>
                        </div>
                      }
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
