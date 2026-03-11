import dbPackage from '@bizing/db'
import { eq } from 'drizzle-orm'

const { db, oodaAsciipDocuments } = dbPackage

const documentPath = 'Catalog CRUD Mockup.asciip'
const title = 'Catalog CRUD Mockup'

const mock = String.raw`+----------------------------------------------------------------------------------------------------------------------+
| Catalog                                                                                     [Import] [Export] [+ New] |
+----------------------------------------------------------------------------------------------------------------------+
| [Products] [Services] [Bundles]                         Search: [________________________]    Filters [v]   Sort [v] |
+----------------------------------------------------------------------------------------------------------------------+
| Left Panel                                 | Main List                                                               |
|--------------------------------------------+-------------------------------------------------------------------------|
| Views                                      | Bulk: [Activate] [Deactivate] [Archive] [Delete]                      |
|  > All Items                               |                                                                         |
|    Products                                | +----+----------------------------+----------+-----------+---------+----+ |
|    Services                                | |Sel | Name                       | Type     | Price     | Status  |Act | |
|    Bundles                                 | +----+----------------------------+----------+-----------+---------+----+ |
|                                            | |[ ] | Beard Oil 30ml             | Product  | $18.00    | Active  |Edit| |
| Collections                                | |[ ] | Haircut (30 min)           | Service  | $45.00    | Active  |Edit| |
|  - Hair Care                               | |[ ] | Coloring (90 min)          | Service  | $120.00   | Draft   |Edit| |
|  - Skin Care                               | |[ ] | Starter Grooming Bundle    | Bundle   | $149.00   | Active  |Edit| |
|  - Seasonal                                | +----+----------------------------+----------+-----------+---------+----+ |
|                                            |                                                                         |
| Tags                                       | Page 1 of 12                                            [< Prev] [Next >]|
|  # New                                     |                                                                         |
|  # Popular                                 |                                                                         |
|  # Premium                                 |                                                                         |
+----------------------------------------------------------------------------------------------------------------------+
| Inspector (Create/Edit Item)                                                                              [x Close] |
|----------------------------------------------------------------------------------------------------------------------|
| Name: [____________________________________]    Slug: [____________________]    Type: ( ) Product ( ) Service       |
| Price: [________]   Duration: [____] min   Category: [____________________]   Tax Class: [__________]              |
| SKU: [____________________]   Inventory: [____]   Visibility: [Draft v]   Channels: [Online][POS]                  |
| Description:                                                                                                          |
| [                                                                                                                   ] |
| [                                                                                                                   ] |
| [                                                                                                                   ] |
|                                                                                                                      |
| [Save Draft]  [Publish]  [Duplicate]  [Archive]                                                                    |
+----------------------------------------------------------------------------------------------------------------------+`

const lines = mock.split('\n')
const diagramId = crypto.randomUUID()
const shapeId = crypto.randomUUID()

const globalStyle = {
  lineStyle: 'LIGHT',
  arrowStyle: 'FILLED',
  arrowStartHead: false,
  arrowEndHead: false,
  rectangleFill: 'NONE',
  rectangleBorder: 'AUTO',
  rectangleTextAlignH: 'LEFT',
  rectangleTextAlignV: 'MIDDLE',
  rectangleTextWrap: 'WORD',
  rectangleTextOverflow: 'TRUNCATE',
  rectangleTextPadding: 1,
}

const editorState = {
  diagrams: [
    {
      id: diagramId,
      name: 'Catalog CRUD',
      data: {
        canvasSize: { rows: 180, cols: 280 },
        shapes: [
          {
            id: shapeId,
            shape: {
              type: 'TEXT',
              start: { r: 2, c: 2 },
              lines,
            },
          },
        ],
        styleMode: 'UNICODE',
        globalStyle,
      },
    },
  ],
  activeDiagramId: diagramId,
  createDiagramInProgress: false,
  deleteDiagramInProgress: null,
  renameDiagramInProgress: null,
}

const existing = (
  await db
    .select()
    .from(oodaAsciipDocuments)
    .where(eq(oodaAsciipDocuments.documentPath, documentPath))
    .limit(1)
)[0]

if (existing) {
  const nextRevision = Number(existing.revision ?? 1) + 1
  await db
    .update(oodaAsciipDocuments)
    .set({
      title,
      editorState,
      revision: nextRevision,
      status: 'active',
      updatedAt: new Date(),
      deletedAt: null,
    })
    .where(eq(oodaAsciipDocuments.id, existing.id))

  console.log(
    JSON.stringify(
      { action: 'updated', id: existing.id, path: documentPath, revision: nextRevision },
      null,
      2,
    ),
  )
} else {
  const inserted = await db
    .insert(oodaAsciipDocuments)
    .values({
      documentPath,
      title,
      editorState,
      status: 'active',
    })
    .returning({
      id: oodaAsciipDocuments.id,
      revision: oodaAsciipDocuments.revision,
    })

  console.log(
    JSON.stringify(
      {
        action: 'created',
        id: inserted[0]?.id,
        path: documentPath,
        revision: inserted[0]?.revision ?? 1,
      },
      null,
      2,
    ),
  )
}

process.exit(0)
