"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printOrderTickets = printOrderTickets;
const { printRawThermalTexts } = require('../../printer.js');
const printers_service_1 = require("./printers.service");
function formatCreatedAt(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }
    return date.toLocaleString('pt-BR');
}
async function buildTicketText(item, order) {
    const template = await (0, printers_service_1.getOrderTicketTemplate)();
    const lines = [];
    if (template.showLogo) {
        lines.push(template.headerText?.trim() || '*** ORDR ***');
    }
    if (order.internalCustomerName?.trim()) {
        lines.push('PEDIDO INTERNO');
        lines.push(`CLIENTE: ${order.internalCustomerName.trim()}`);
        if (order.status) {
            lines.push(`STATUS: ${String(order.status).toUpperCase()}`);
        }
    }
    else {
        lines.push(`COMANDA: ${order.comanda}`);
    }
    if (template.showComandaName && order.comandaName?.trim()) {
        lines.push(`NOME: ${order.comandaName.trim()}`);
    }
    if (template.showOrderId) {
        lines.push(`PEDIDO: ${order.id}`);
    }
    if (order.observation?.trim()) {
        lines.push('OBS PEDIDO:');
        lines.push(order.observation.trim());
    }
    lines.push('--------------------------');
    lines.push(item.product.name);
    if (template.showVariations) {
        for (const variation of item.variations ?? []) {
            for (const opt of variation.options ?? []) {
                lines.push(`${variation.group.name}: ${opt.option.name}`);
            }
        }
    }
    if (template.showNotes && item.notes?.trim()) {
        lines.push('OBS ITEM:');
        lines.push(item.notes.trim());
    }
    lines.push('--------------------------');
    if (template.showDate) {
        lines.push(formatCreatedAt(order.createdAt));
    }
    if (template.footerText?.trim()) {
        lines.push(template.footerText.trim());
    }
    lines.push('');
    lines.push('');
    lines.push('');
    return lines.join('\n');
}
async function printOrderTickets(order) {
    const printerName = await (0, printers_service_1.getSelectedOrderPrinterName)();
    if (!printerName) {
        throw new Error('ORDER_PRINTER_NOT_CONFIGURED');
    }
    const texts = [];
    for (const item of order.items) {
        const quantity = Number(item.quantity ?? 0);
        for (let i = 0; i < quantity; i++) {
            texts.push(await buildTicketText(item, order));
        }
    }
    if (texts.length === 0) {
        throw new Error('ORDER_HAS_NO_PRINTABLE_ITEMS');
    }
    await printRawThermalTexts(texts, {
        printerName,
        feedLines: 6,
        cut: true,
    });
}
