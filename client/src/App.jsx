import { useEffect, useMemo, useState } from "react";

const defaultMeasurements = {
  chest: "",
  waist: "",
  shoulder: "",
  sleeveLength: "",
  hip: "",
  neck: "",
  length: "",
  notes: "",
};

const defaultCustomerForm = {
  fullName: "",
  phone: "",
  address: "",
  gender: "Not specified",
  notes: "",
};

const defaultOrderForm = {
  clothingType: "",
  stitchingDetails: "",
  deliveryDate: "",
  status: "Pending",
  price: "",
};

function currency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function requestJson(url, options = {}) {
  const token = localStorage.getItem("tailor-token");
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}

export default function App() {
  const [session, setSession] = useState({ authenticated: false, user: null });
  const [stats, setStats] = useState({});
  const [customers, setCustomers] = useState([]);
  const [upcomingOrders, setUpcomingOrders] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [measurements, setMeasurements] = useState(defaultMeasurements);
  const [orders, setOrders] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerForm, setCustomerForm] = useState(defaultCustomerForm);
  const [orderForm, setOrderForm] = useState(defaultOrderForm);
  const [loginForm, setLoginForm] = useState({ username: "admin", password: "admin123" });
  const [statusMessage, setStatusMessage] = useState("Loading project...");
  const [paymentForms, setPaymentForms] = useState({});

  const statCards = useMemo(
    () => [
      {
        label: "Customers",
        value: stats.totalCustomers || 0,
        note: "Active customer profiles",
      },
      {
        label: "Orders",
        value: stats.totalOrders || 0,
        note: `${stats.pendingOrders || 0} pending, ${stats.inProgressOrders || 0} in progress`,
      },
      {
        label: "Completed / Delivered",
        value: `${stats.completedOrders || 0} / ${stats.deliveredOrders || 0}`,
        note: "Ready pieces vs handed-over orders",
      },
      {
        label: "Revenue",
        value: currency(stats.collectedRevenue || 0),
        note: "Collected payments so far",
      },
    ],
    [stats],
  );

  async function loadSession() {
    const payload = await requestJson("/api/auth/session");
    setSession(payload);
    if (payload.authenticated) {
      setStatusMessage(`Welcome back, ${payload.user.fullName}.`);
      await loadDashboard();
    } else {
      setStatusMessage("Login with the demo tailor account to continue.");
    }
  }

  async function loadDashboard() {
    const payload = await requestJson(`/api/dashboard${customerSearch ? `?search=${encodeURIComponent(customerSearch)}` : ""}`);
    setStats(payload.stats);
    setCustomers(payload.customers);
    setUpcomingOrders(payload.upcomingOrders);

    const nextCustomerId =
      selectedCustomerId && payload.customers.some((customer) => customer._id === selectedCustomerId)
        ? selectedCustomerId
        : payload.customers[0]?._id;

    if (nextCustomerId) {
      await loadCustomer(nextCustomerId);
    } else {
      setSelectedCustomerId(null);
      setSelectedCustomer(null);
      setMeasurements(defaultMeasurements);
      setOrders([]);
    }
  }

  async function loadCustomer(customerId) {
    const payload = await requestJson(`/api/customers/${customerId}`);
    setSelectedCustomerId(customerId);
    setSelectedCustomer(payload.customer);
    setMeasurements({
      chest: payload.measurements?.chest ?? "",
      waist: payload.measurements?.waist ?? "",
      shoulder: payload.measurements?.shoulder ?? "",
      sleeveLength: payload.measurements?.sleeveLength ?? "",
      hip: payload.measurements?.hip ?? "",
      neck: payload.measurements?.neck ?? "",
      length: payload.measurements?.length ?? "",
      notes: payload.measurements?.notes ?? "",
    });
    setOrders(payload.orders);
  }

  useEffect(() => {
    loadSession().catch((error) => setStatusMessage(error.message));
  }, []);

  useEffect(() => {
    if (!session.authenticated) return;
    const handle = setTimeout(() => {
      loadDashboard().catch((error) => setStatusMessage(error.message));
    }, 250);
    return () => clearTimeout(handle);
  }, [customerSearch]);

  async function handleLogin(event) {
    event.preventDefault();
    try {
      const payload = await requestJson("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(loginForm),
      });
      localStorage.setItem("tailor-token", payload.token);
      await loadSession();
    } catch (error) {
      setStatusMessage(error.message);
    }
  }

  async function handleLogout() {
    try {
      await requestJson("/api/auth/logout", { method: "POST" });
    } catch {}
    localStorage.removeItem("tailor-token");
    setSession({ authenticated: false, user: null });
    setStatusMessage("You have been logged out.");
  }

  async function handleCreateCustomer(event) {
    event.preventDefault();
    try {
      const payload = await requestJson("/api/customers", {
        method: "POST",
        body: JSON.stringify(customerForm),
      });
      setCustomerForm(defaultCustomerForm);
      setStatusMessage("Customer added successfully.");
      await loadDashboard();
      await loadCustomer(payload.customerId);
    } catch (error) {
      setStatusMessage(error.message);
    }
  }

  async function handleSaveMeasurements(event) {
    event.preventDefault();
    if (!selectedCustomerId) return;
    try {
      await requestJson(`/api/customers/${selectedCustomerId}/measurements`, {
        method: "PUT",
        body: JSON.stringify(measurements),
      });
      setStatusMessage("Measurements saved.");
      await loadCustomer(selectedCustomerId);
      await loadDashboard();
    } catch (error) {
      setStatusMessage(error.message);
    }
  }

  async function handleCreateOrder(event) {
    event.preventDefault();
    if (!selectedCustomerId) return;
    try {
      await requestJson("/api/orders", {
        method: "POST",
        body: JSON.stringify({ ...orderForm, customerId: selectedCustomerId }),
      });
      setOrderForm(defaultOrderForm);
      setStatusMessage("Order created.");
      await loadDashboard();
    } catch (error) {
      setStatusMessage(error.message);
    }
  }

  async function handleStatusUpdate(orderId, status) {
    try {
      await requestJson(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setStatusMessage("Order status updated.");
      await loadDashboard();
    } catch (error) {
      setStatusMessage(error.message);
    }
  }

  async function handlePaymentSubmit(event, orderId) {
    event.preventDefault();
    const current = paymentForms[orderId] || { amount: "", method: "Cash", notes: "" };
    try {
      await requestJson(`/api/orders/${orderId}/payments`, {
        method: "POST",
        body: JSON.stringify(current),
      });
      setPaymentForms((prev) => ({ ...prev, [orderId]: { amount: "", method: "Cash", notes: "" } }));
      setStatusMessage("Payment recorded.");
      await loadDashboard();
    } catch (error) {
      setStatusMessage(error.message);
    }
  }

  if (!session.authenticated) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <p className="eyebrow">React + Express + MongoDB</p>
          <h1>Tailor Management System</h1>
          <p className="lede">
            Manage customers, measurements, orders, delivery flow, and payments from one digital tailor desk.
          </p>
          <form className="stack-form" onSubmit={handleLogin}>
            <label>
              <span>Username</span>
              <input
                value={loginForm.username}
                onChange={(event) => setLoginForm((prev) => ({ ...prev, username: event.target.value }))}
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
              />
            </label>
            <button type="submit">Login</button>
          </form>
          <p className="status-text">{statusMessage}</p>
        </section>
      </main>
    );
  }

  return (
    <div className="page-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Operational Dashboard</p>
          <h1>Tailor Management System</h1>
          <p className="lede">Track every customer from measurement intake to delivery and final billing.</p>
        </div>
        <div className="hero-actions">
          <span className="user-chip">{session.user?.fullName}</span>
          <button className="secondary-button" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <section className="stats-grid">
        {statCards.map((card) => (
          <article className="stat-card" key={card.label}>
            <span className="stat-label">{card.label}</span>
            <strong className="stat-value">{card.value}</strong>
            <p className="stat-note">{card.note}</p>
          </article>
        ))}
      </section>

      <p className="status-text">{statusMessage}</p>

      <main className="dashboard-grid">
        <aside className="panel">
          <div className="panel-heading">
            <div>
              <h2>Customers</h2>
              <p>Search or add customer records.</p>
            </div>
          </div>
          <label className="search-box">
            <span>Find customer</span>
            <input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Name, phone, address" />
          </label>
          <div className="customer-list">
            {customers.length ? (
              customers.map((customer) => (
                <button
                  key={customer._id}
                  className={`customer-item ${customer._id === selectedCustomerId ? "active" : ""}`}
                  type="button"
                  onClick={() => loadCustomer(customer._id)}
                >
                  <strong>{customer.fullName}</strong>
                  <span>{customer.phone}</span>
                  <small>{customer.orderCount} order(s)</small>
                </button>
              ))
            ) : (
              <div className="empty-state">No customers found.</div>
            )}
          </div>

          <form className="stack-form" onSubmit={handleCreateCustomer}>
            <h3>Add Customer</h3>
            <label>
              <span>Full name</span>
              <input value={customerForm.fullName} onChange={(event) => setCustomerForm((prev) => ({ ...prev, fullName: event.target.value }))} required />
            </label>
            <label>
              <span>Phone</span>
              <input value={customerForm.phone} onChange={(event) => setCustomerForm((prev) => ({ ...prev, phone: event.target.value }))} required />
            </label>
            <label>
              <span>Address</span>
              <textarea value={customerForm.address} onChange={(event) => setCustomerForm((prev) => ({ ...prev, address: event.target.value }))} rows="2" required />
            </label>
            <label>
              <span>Gender</span>
              <select value={customerForm.gender} onChange={(event) => setCustomerForm((prev) => ({ ...prev, gender: event.target.value }))}>
                <option>Female</option>
                <option>Male</option>
                <option>Other</option>
                <option>Not specified</option>
              </select>
            </label>
            <label>
              <span>Notes</span>
              <textarea value={customerForm.notes} onChange={(event) => setCustomerForm((prev) => ({ ...prev, notes: event.target.value }))} rows="2" />
            </label>
            <button type="submit">Save Customer</button>
          </form>
        </aside>

        <section className="panel detail-panel">
          <div className="panel-heading">
            <div>
              <h2>{selectedCustomer?.fullName || "Select a customer"}</h2>
              <p>{selectedCustomer ? `${selectedCustomer.phone} • ${selectedCustomer.address}` : "Customer profile appears here."}</p>
            </div>
            {selectedCustomer ? (
              <div className="badge-row">
                <span className="pill">{selectedCustomer.gender}</span>
                <span className="pill">{orders.length} order(s)</span>
              </div>
            ) : null}
          </div>

          <div className="detail-layout">
            <form className="stack-form" onSubmit={handleSaveMeasurements}>
              <h3>Measurements</h3>
              <div className="measurement-grid">
                {[
                  ["chest", "Chest"],
                  ["waist", "Waist"],
                  ["shoulder", "Shoulder"],
                  ["sleeveLength", "Sleeve"],
                  ["hip", "Hip"],
                  ["neck", "Neck"],
                  ["length", "Length"],
                ].map(([key, label]) => (
                  <label key={key}>
                    <span>{label}</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={measurements[key]}
                      onChange={(event) => setMeasurements((prev) => ({ ...prev, [key]: event.target.value }))}
                    />
                  </label>
                ))}
              </div>
              <label>
                <span>Measurement notes</span>
                <textarea
                  rows="3"
                  value={measurements.notes}
                  onChange={(event) => setMeasurements((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </label>
              <button type="submit" disabled={!selectedCustomerId}>
                Save Measurements
              </button>
            </form>

            <form className="stack-form" onSubmit={handleCreateOrder}>
              <h3>Create Order</h3>
              <label>
                <span>Clothing type</span>
                <input value={orderForm.clothingType} onChange={(event) => setOrderForm((prev) => ({ ...prev, clothingType: event.target.value }))} required />
              </label>
              <label>
                <span>Stitching details</span>
                <textarea rows="3" value={orderForm.stitchingDetails} onChange={(event) => setOrderForm((prev) => ({ ...prev, stitchingDetails: event.target.value }))} required />
              </label>
              <div className="measurement-grid">
                <label>
                  <span>Delivery date</span>
                  <input type="date" value={orderForm.deliveryDate} onChange={(event) => setOrderForm((prev) => ({ ...prev, deliveryDate: event.target.value }))} required />
                </label>
                <label>
                  <span>Status</span>
                  <select value={orderForm.status} onChange={(event) => setOrderForm((prev) => ({ ...prev, status: event.target.value }))}>
                    <option>Pending</option>
                    <option>In Progress</option>
                    <option>Completed</option>
                    <option>Delivered</option>
                  </select>
                </label>
                <label>
                  <span>Price</span>
                  <input type="number" min="1" step="0.01" value={orderForm.price} onChange={(event) => setOrderForm((prev) => ({ ...prev, price: event.target.value }))} required />
                </label>
              </div>
              <button type="submit" disabled={!selectedCustomerId}>
                Create Order
              </button>
            </form>
          </div>

          <section>
            <div className="panel-heading compact">
              <div>
                <h3>Order Timeline</h3>
                <p>Update stitching progress and collect payments.</p>
              </div>
            </div>
            <div className="order-list">
              {orders.length ? (
                orders.map((order) => (
                  <article className="order-card" key={order._id}>
                    <div className="order-top">
                      <div>
                        <h4>{order.clothingType}</h4>
                        <p>{order.stitchingDetails}</p>
                      </div>
                      <span className={`status-chip status-${order.status.toLowerCase().replace(/\s+/g, "-")}`}>{order.status}</span>
                    </div>

                    <div className="order-metrics">
                      <div><span>Delivery</span><strong>{formatDate(order.deliveryDate)}</strong></div>
                      <div><span>Price</span><strong>{currency(order.price)}</strong></div>
                      <div><span>Paid</span><strong>{currency(order.totalPaid)}</strong></div>
                      <div><span>Balance</span><strong>{currency(order.balanceDue)}</strong></div>
                    </div>

                    <div className="order-actions">
                      <label>
                        <span>Status</span>
                        <select value={order.status} onChange={(event) => handleStatusUpdate(order._id, event.target.value)}>
                          <option>Pending</option>
                          <option>In Progress</option>
                          <option>Completed</option>
                          <option>Delivered</option>
                        </select>
                      </label>
                      <span className="payment-tag">{order.paymentStatus}</span>
                    </div>

                    <div className="payment-area">
                      <div>
                        <strong>Payment History</strong>
                        <ul className="payment-history">
                          {order.payments.length ? (
                            order.payments.map((payment) => (
                              <li key={payment._id}>
                                {formatDate(payment.paidOn)} • {payment.method} • {currency(payment.amount)}
                              </li>
                            ))
                          ) : (
                            <li>No payments recorded yet.</li>
                          )}
                        </ul>
                      </div>
                      <form className="stack-form" onSubmit={(event) => handlePaymentSubmit(event, order._id)}>
                        <div className="payment-grid">
                          <label>
                            <span>Amount</span>
                            <input
                              type="number"
                              min="1"
                              step="0.01"
                              value={paymentForms[order._id]?.amount || ""}
                              onChange={(event) =>
                                setPaymentForms((prev) => ({
                                  ...prev,
                                  [order._id]: { ...(prev[order._id] || { method: "Cash", notes: "" }), amount: event.target.value },
                                }))
                              }
                              required
                            />
                          </label>
                          <label>
                            <span>Method</span>
                            <select
                              value={paymentForms[order._id]?.method || "Cash"}
                              onChange={(event) =>
                                setPaymentForms((prev) => ({
                                  ...prev,
                                  [order._id]: { ...(prev[order._id] || { amount: "", notes: "" }), method: event.target.value },
                                }))
                              }
                            >
                              <option>Cash</option>
                              <option>UPI</option>
                              <option>Card</option>
                              <option>Bank Transfer</option>
                            </select>
                          </label>
                        </div>
                        <label>
                          <span>Note</span>
                          <input
                            value={paymentForms[order._id]?.notes || ""}
                            onChange={(event) =>
                              setPaymentForms((prev) => ({
                                ...prev,
                                [order._id]: { ...(prev[order._id] || { amount: "", method: "Cash" }), notes: event.target.value },
                              }))
                            }
                          />
                        </label>
                        <button type="submit">Record Payment</button>
                      </form>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">No orders yet for this customer.</div>
              )}
            </div>
          </section>
        </section>

        <aside className="panel">
          <div className="panel-heading">
            <div>
              <h2>Delivery Queue</h2>
              <p>Upcoming jobs across the shop.</p>
            </div>
          </div>
          <div className="upcoming-orders">
            {upcomingOrders.length ? (
              upcomingOrders.map((order) => (
                <article className="queue-item" key={order._id}>
                  <div>
                    <strong>{order.customerName}</strong>
                    <p>{order.clothingType}</p>
                  </div>
                  <div className="queue-meta">
                    <span>{formatDate(order.deliveryDate)}</span>
                    <span className={`status-chip status-${order.status.toLowerCase().replace(/\s+/g, "-")}`}>{order.status}</span>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">No upcoming deliveries.</div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
