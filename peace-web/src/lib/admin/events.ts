// Fired after an admin changes an order or return so the menu badge refreshes at once.
export const ORDERS_CHANGED_EVENT = "admin:orders-changed";
export const notifyOrdersChanged = () => window.dispatchEvent(new Event(ORDERS_CHANGED_EVENT));
