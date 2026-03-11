import dbPackage from '@bizing/db'
const { valueLedgerEntries, inventoryProcurementOrders, inventoryReplenishmentSuggestions, workforcePerformanceReviews } = dbPackage as any
console.log('has valueLedgerEntries.createdAt', 'createdAt' in valueLedgerEntries)
console.log('has valueLedgerEntries.createdBy', 'createdBy' in valueLedgerEntries)
console.log('has inventoryProcurementOrders.createdAt', 'createdAt' in inventoryProcurementOrders)
console.log('has inventoryReplenishmentSuggestions.createdAt', 'createdAt' in inventoryReplenishmentSuggestions)
console.log('has workforcePerformanceReviews.updatedAt', 'updatedAt' in workforcePerformanceReviews)
