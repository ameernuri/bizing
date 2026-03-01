import dbPackage from '@bizing/db'

const runIds = [
'saga_run_3AH11gRt3NGcjBk1r6udWduAXin',
'saga_run_3AH1DVPd4yKkhySwcj1oYJH6ICy',
'saga_run_3AH1NlHTc0g8x1kdG6aNEseFKuJ',
'saga_run_3AH1XV0tWhgDA4qq7oZTXPkYobF',
'saga_run_3AH1gqGxIflNLzmW4Zc07sWf7z2',
'saga_run_3AH1qt772l6d4oGQT1FuS393XBn',
'saga_run_3AH23KdbbSeWLBF9JcwoJ8xyKNL',
'saga_run_3AH2EZDKTYwe0i7NgeHUfMpF7z4',
]
const rows = await dbPackage.db.query.sagaRunSteps.findMany({
  where: (table, helpers) => helpers.and(helpers.inArray(table.sagaRunId, runIds), helpers.inArray(table.status, ['failed','blocked'])),
  columns: { sagaRunId: true, stepKey: true, status: true, instruction: true, expectedResult: true, failureMessage: true },
})
for (const row of rows) console.log(JSON.stringify(row))
await dbPackage.pool.end()
