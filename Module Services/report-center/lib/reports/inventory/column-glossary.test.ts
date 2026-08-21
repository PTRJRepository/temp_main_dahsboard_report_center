import assert from 'node:assert/strict'
import {
  getInventoryColumnGlossary,
  inventoryColumnHelpText,
  inventoryColumnLabel,
  inventoryColumnTitleAttribute,
} from './column-glossary'

assert.equal(inventoryColumnLabel('QuantityClosing'), 'Quantity Closing')
assert.equal(inventoryColumnLabel('ReceivedAmount'), 'Received Amount')
assert.equal(inventoryColumnLabel('TransferredAmount'), 'Transfered Amount')
assert.match(inventoryColumnHelpText('QuantityClosing'), /QtyOnHand \+ QtyOnHold \+ QtyOnOrder/)
assert.match(inventoryColumnHelpText('MovementCategory'), /all-period/i)
assert.match(inventoryColumnTitleAttribute('MovementGapQty'), /QuantityClosing - StockIssueQty/)
assert.equal(getInventoryColumnGlossary('total_amount')?.formula, 'total_quantity * unit_cost')
assert.match(inventoryColumnHelpText('total_amount'), /bukan sum amount movement/i)
assert.match(inventoryColumnHelpText('MovementCategory'), /bukan dasar total valuasi/i)
assert.equal(getInventoryColumnGlossary('unknown_field'), undefined)

console.info('inventory column-glossary tests passed')
