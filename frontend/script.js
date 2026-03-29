const API_BASE = 'http://localhost:5000/api';
let currentUser = null;
let cart = [];
let allProducts = []; // Local cache of products for the POS grid
const TAX_RATE = 0.15;
const LOW_STOCK_THRESHOLD = 10;

/* ─── API HELPER ─── */
async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('pos_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
        const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || `API Error: ${res.status}`);
        }
        return await res.json();
    } catch (err) {
        toast(err.message, 'err');
        console.error(err);
        return null;
    }
}

/* ─── INIT ─── */
window.addEventListener('DOMContentLoaded', () => {
    // Attempt auto-login if token exists
    const storedUser = localStorage.getItem('pos_user');
    const token = localStorage.getItem('pos_token');
    if (storedUser && token) {
        currentUser = JSON.parse(storedUser);
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('appShell').style.display = 'flex';
        setupUserUI();
        showPage('dashboard', document.querySelector('.nav-btn'));
        startClock();
        updateDBStatus(true);
    } else {
        updateDBStatus(false, 'Please Log In');
    }

    document.getElementById('loginPass').addEventListener('keydown', e => { 
        if (e.key === 'Enter') doLogin(); 
    });
});

function updateDBStatus(ok, msg = '● Connected to Node.js API') {
    const el = document.getElementById('dbStatus');
    if (!el) return;
    el.textContent = ok ? msg : '● Disconnected';
    el.className = 'db-status ' + (ok ? 'ok' : 'err');
}

/* ─── AUTH ─── */
async function doLogin() {
    const u = document.getElementById('loginUser').value.trim();
    const p = document.getElementById('loginPass').value.trim();
    
    const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: u, password: p })
    });

    if (data && data.token) {
        localStorage.setItem('pos_token', data.token);
        localStorage.setItem('pos_user', JSON.stringify(data.user));
        currentUser = data.user;
        
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('appShell').style.display = 'flex';
        updateDBStatus(true);
        setupUserUI();
        showPage('dashboard', document.querySelector('.nav-btn'));
        startClock();
    } else {
        document.getElementById('loginErr').style.display = 'block';
    }
}

function doLogout() {
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
    currentUser = null; 
    cart = [];
    document.getElementById('appShell').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    updateDBStatus(false, 'Please Log In');
}

function setupUserUI() {
    if (!currentUser) return;
    const r = currentUser.role.toLowerCase();
    document.getElementById('sidebarUsername').textContent = currentUser.username;
    document.getElementById('sidebarRole').textContent = currentUser.role;
    const av = document.getElementById('sidebarAvatar');
    av.textContent = currentUser.username[0].toUpperCase();
    av.className = 'avatar ' + r;
}

/* ─── NAVIGATION ─── */
function showPage(id, btn) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('page-' + id).classList.add('active');
    if (btn) btn.classList.add('active');

    const titles = {
        dashboard: ['Dashboard', 'Overview of today\'s activity'],
        pos: ['Point of Sale', 'Process customer transactions'],
        products: ['Products', 'Manage product catalog'],
        inventory: ['Inventory', 'Track stock levels'],
        customers: ['Customers', 'Customer records & loyalty'],
        sales: ['Sales History', 'All transactions'],
        reports: ['Reports & Analytics', 'Business performance'],
    };
    const t = titles[id] || [id, ''];
    document.getElementById('topbarTitle').textContent = t[0];
    document.getElementById('topbarSub').textContent = t[1];

    const renderMap = {
        dashboard: renderDashboard,
        pos: renderPOS,
        products: renderProducts,
        inventory: renderInventory,
        customers: renderCustomers,
        sales: renderSales,
        reports: renderReports,
    };
    if (renderMap[id]) renderMap[id]();
    updateLowStockBadge();
}

/* ─── CLOCK & TOAST & BADGE ─── */
function startClock() {
    function tick() {
        const el = document.getElementById('clockDisplay');
        if (el) el.textContent = new Date().toLocaleTimeString('en-GH', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    }
    tick(); setInterval(tick, 1000);
}

function toast(msg, type = 'ok') {
    const t = document.getElementById('toast');
    t.querySelector('.toast-msg').textContent = msg;
    t.className = 'toast show ' + type;
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

async function updateLowStockBadge() {
    const products = await apiFetch('/products');
    if (!products) return;
    const count = products.filter(p => p.qty <= LOW_STOCK_THRESHOLD).length;
    const badge = document.getElementById('lowStockBadge');
    if (badge) { 
        badge.textContent = count; 
        badge.style.display = count > 0 ? '' : 'none'; 
    }
}

/* ════════════════════════════════ DASHBOARD ═══════════════════════════════ */
async function renderDashboard() {
    const metrics = await apiFetch('/reports/dashboard');
    if (!metrics) return;

    document.getElementById('d-revenue').textContent = 'GHS ' + Number(metrics.todayRevenue).toFixed(2);
    document.getElementById('d-txns').textContent = metrics.todayTxns;
    document.getElementById('d-products').textContent = metrics.totalProds;
    document.getElementById('d-lowstock').textContent = metrics.lowStock;
    document.getElementById('d-customers').textContent = metrics.totalCusts;
    document.getElementById('d-allrevenue').textContent = 'GHS ' + Number(metrics.allRevenue).toFixed(2);

    const recent = await apiFetch('/sales');
    const tbody = document.getElementById('d-recent');
    // Only show last 8 on dashboard
    const displayRecent = recent ? recent.slice(0, 8) : [];
    
    tbody.innerHTML = displayRecent.length ? displayRecent.map(s => `
        <tr>
            <td><span class="mono" style="color:var(--accent)">#${String(s.id).padStart(4,'0')}</span></td>
            <td>${new Date(s.created_at).toLocaleString('en-GH').slice(0,17)}</td>
            <td>${s.cashier}</td>
            <td>${s.customer_name}</td>
            <td><span class="mono" style="color:var(--green)">GHS ${Number(s.total).toFixed(2)}</span></td>
            <td><span class="badge ${payBadge(s.payment_method)}">${s.payment_method}</span></td>
        </tr>`).join('') :
        `<tr><td colspan="6" class="tbl-empty">No transactions yet</td></tr>`;
}

function payBadge(m) { return m==='Cash'?'green':m==='Mobile Money'?'amber':'blue'; }

/* ════════════════════════════════ POS ═════════════════════════════════════ */
async function renderPOS() {
    await loadProductsForPOS();
    populatePOSCustomers();
    renderCart();
}

async function loadProductsForPOS() {
    const products = await apiFetch('/products');
    if (products) {
        allProducts = products.filter(p => p.qty > 0);
        renderProductGrid();
    }
}

function renderProductGrid(filterText = '') {
    const f = filterText.toLowerCase();
    const catFilter = document.getElementById('posCatFilter')?.value || '';
    
    let filtered = allProducts;
    if (f) filtered = filtered.filter(p => p.name.toLowerCase().includes(f));
    if (catFilter) filtered = filtered.filter(p => p.category === catFilter);

    const grid = document.getElementById('productGrid');
    grid.innerHTML = filtered.length ? filtered.map(p => {
        const stockColor = p.qty <= 5 ? 'var(--red)' : p.qty <= 10 ? 'var(--amber)' : 'var(--text-muted)';
        return `<div class="product-tile" onclick="addToCart(${p.id})">
            <div class="tile-cat">${p.category}</div>
            <div class="tile-name">${p.name}</div>
            <div class="tile-price">GHS ${Number(p.price).toFixed(2)}</div>
            <div class="tile-stock" style="color:${stockColor}">Stock: ${p.qty}</div>
        </div>`;
    }).join('') : `<div style="color:var(--text-muted);font-size:13px;padding:20px">No products found</div>`;
}

async function populatePOSCustomers() {
    const custs = await apiFetch('/customers');
    const sel = document.getElementById('posCustomer');
    if (!custs) return;
    sel.innerHTML = `<option value="">Walk-in customer</option>` +
        custs.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function addToCart(pid) {
    const prod = allProducts.find(p => p.id === pid);
    if (!prod) return;
    const existing = cart.find(i => i.pid === pid);
    if (existing) {
        if (existing.qty >= prod.qty) { toast('Not enough stock', 'err'); return; }
        existing.qty++;
    } else {
        cart.push({ pid: prod.id, name: prod.name, price: prod.price, qty: 1, maxQty: prod.qty });
    }
    renderCart();
}

function changeQty(idx, delta) {
    const item = cart[idx];
    const newQty = item.qty + delta;
    if (newQty < 1) { removeCartItem(idx); return; }
    if (newQty > item.maxQty) { toast('Max stock reached', 'err'); return; }
    item.qty = newQty;
    renderCart();
}

function removeCartItem(idx) { cart.splice(idx, 1); renderCart(); }

function renderCart() {
    const el = document.getElementById('cartItems');
    if (!cart.length) {
        el.innerHTML = `<div class="cart-empty">🛒<br>Cart is empty<br><span style="font-size:11px">Click a product to add</span></div>`;
    } else {
        el.innerHTML = cart.map((item, i) => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">GHS ${Number(item.price).toFixed(2)} each</div>
                </div>
                <div class="qty-ctrl">
                    <button class="qty-btn" onclick="changeQty(${i},-1)">−</button>
                    <span class="qty-num">${item.qty}</span>
                    <button class="qty-btn" onclick="changeQty(${i},1)">+</button>
                </div>
                <div class="cart-item-total">GHS ${(item.price * item.qty).toFixed(2)}</div>
                <span class="cart-del" onclick="removeCartItem(${i})">✕</span>
            </div>`).join('');
    }
    calcTotals();
}

function calcTotals() {
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const disc = Math.max(0, Math.min(100, parseFloat(document.getElementById('discountInp')?.value) || 0));
    const discAmt = subtotal * disc / 100;
    const afterDisc = subtotal - discAmt;
    const tax = afterDisc * TAX_RATE;
    const total = afterDisc + tax;

    document.getElementById('cartSubtotal').textContent = 'GHS ' + subtotal.toFixed(2);
    document.getElementById('cartDiscount').textContent = disc > 0 ? `-GHS ${discAmt.toFixed(2)}` : 'GHS 0.00';
    document.getElementById('cartTax').textContent = 'GHS ' + tax.toFixed(2);
    document.getElementById('cartTotal').textContent = 'GHS ' + total.toFixed(2);

    calcChange(total);
    return { subtotal, discAmt, tax, total, disc };
}

function calcChange(total) {
    if (total === undefined) {
        const t = parseFloat(document.getElementById('cartTotal')?.textContent?.replace('GHS ', '') || 0);
        total = t;
    }
    const method = document.getElementById('payMethod')?.value;
    const received = parseFloat(document.getElementById('cashReceived')?.value) || 0;
    const chEl = document.getElementById('changeDisplay');
    if (!chEl) return;
    if (method === 'Cash' && received > 0) {
        const change = received - total;
        chEl.style.display = 'block';
        chEl.className = change >= 0 ? 'change-display' : 'short-display';
        chEl.textContent = change >= 0 ? `Change: GHS ${change.toFixed(2)}` : `Short: GHS ${Math.abs(change).toFixed(2)}`;
    } else { chEl.style.display = 'none'; }
}

async function completeSale() {
    if (!cart.length) { toast('Cart is empty', 'err'); return; }
    const { subtotal, discAmt, tax, total, disc } = calcTotals();
    const method = document.getElementById('payMethod').value;
    const cashRec = parseFloat(document.getElementById('cashReceived').value) || 0;
    
    if (method === 'Cash' && cashRec < total) { toast('Insufficient cash received', 'err'); return; }

    const custSel = document.getElementById('posCustomer');
    const custId = custSel.value || null;
    const custName = custId ? custSel.options[custSel.selectedIndex].text : 'Walk-in';

    const payload = {
        cashier: currentUser.username,
        customer_id: custId,
        customer_name: custName,
        subtotal,
        discount: discAmt,
        tax,
        total,
        payment_method: method,
        cash_received: cashRec,
        items: cart
    };

    const res = await apiFetch('/sales', {
        method: 'POST',
        body: JSON.stringify(payload)
    });

    if (res) {
        const saleData = { ...payload, id: res.saleId, items: [...cart], disc };
        cart = [];
        document.getElementById('discountInp').value = '0';
        document.getElementById('cashReceived').value = '';
        renderCart(); 
        await loadProductsForPOS(); 
        updateLowStockBadge();
        showReceipt(saleData);
        toast('Sale completed! GHS ' + total.toFixed(2));
    }
}

function showReceipt(s) {
    const now = new Date().toLocaleString('en-GH');
    document.getElementById('receiptModal').style.display = 'flex';
    document.getElementById('receiptBody').innerHTML = `
        <div class="receipt-line"><span>Receipt #</span><span class="mono">${String(s.id).padStart(4,'0')}</span></div>
        <div class="receipt-line"><span>Date</span><span>${now}</span></div>
        <div class="receipt-line"><span>Cashier</span><span>${s.cashier}</span></div>
        <div class="receipt-line"><span>Customer</span><span>${s.customer_name}</span></div>
        <div class="receipt-line"><span>Payment</span><span><b>${s.payment_method}</b></span></div>
        <hr class="divider">
        <div style="font-size:11px;font-weight:600;color:var(--text-muted);letter-spacing:.05em;text-transform:uppercase;margin-bottom:6px">Items</div>
        ${s.items.map(i => `<div class="receipt-item"><span>${i.name} ×${i.qty}</span><span class="mono">GHS ${(i.price*i.qty).toFixed(2)}</span></div>`).join('')}
        <hr class="divider">
        <div class="receipt-line"><span>Subtotal</span><span class="mono">GHS ${s.subtotal.toFixed(2)}</span></div>
        ${s.disc>0?`<div class="receipt-line"><span>Discount (${s.disc}%)</span><span class="mono" style="color:var(--green)">-GHS ${s.discount.toFixed(2)}</span></div>`:''}
        <div class="receipt-line"><span>Tax (15%)</span><span class="mono">GHS ${s.tax.toFixed(2)}</span></div>
        <div class="receipt-line bold" style="font-size:16px;margin-top:4px"><span>TOTAL</span><span class="mono" style="color:var(--accent)">GHS ${s.total.toFixed(2)}</span></div>
        ${s.payment_method==='Cash'?`<div class="receipt-line" style="margin-top:4px"><span>Cash received</span><span class="mono">GHS ${Number(s.cash_received).toFixed(2)}</span></div><div class="receipt-line" style="color:var(--green)"><span>Change</span><span class="mono">GHS ${(s.cash_received-s.total).toFixed(2)}</span></div>`:''}
    `;
}

function closeReceipt() { document.getElementById('receiptModal').style.display = 'none'; }

/* ════════════════════════════════ PRODUCTS ════════════════════════════════ */
let editingProductId = null;

async function renderProducts() {
    const prods = await apiFetch('/products');
    if (!prods) return;

    const q = (document.getElementById('prodSearch')?.value || '').toLowerCase();
    const filtered = q ? prods.filter(p => p.name.toLowerCase().includes(q)) : prods;

    document.getElementById('prodCount').textContent = filtered.length;
    document.getElementById('productTable').innerHTML = filtered.length ? filtered.map(p => {
        const badge = p.qty <= 5 ? '<span class="badge red">Critical</span>'
                    : p.qty <= 10 ? '<span class="badge amber">Low</span>'
                    : '<span class="badge green">OK</span>';
        return `<tr>
            <td><span class="mono" style="color:var(--text-muted)">#${p.id}</span></td>
            <td style="color:var(--text-primary);font-weight:500">${p.name}</td>
            <td><span class="badge teal">${p.category}</span></td>
            <td><span class="mono" style="color:var(--accent)">GHS ${Number(p.price).toFixed(2)}</span></td>
            <td>${p.qty} ${badge}</td>
            <td><span class="mono text-sm">${p.barcode || '—'}</span></td>
            <td>${p.supplier || '—'}</td>
            <td>
                <div class="flex gap-sm">
                    <button class="btn sm" onclick="editProduct(${p.id})">Edit</button>
                    <button class="btn sm danger" onclick="deleteProduct(${p.id})">Delete</button>
                </div>
            </td>
        </tr>`;
    }).join('') : `<tr><td colspan="8" class="tbl-empty">No products found</td></tr>`;
}

async function saveProduct() {
    const name     = document.getElementById('pName').value.trim();
    const cat      = document.getElementById('pCat').value;
    const price    = parseFloat(document.getElementById('pPrice').value);
    const qty      = parseInt(document.getElementById('pQty').value);
    const barcode  = document.getElementById('pBarcode').value.trim();
    const supplier = document.getElementById('pSupplier').value.trim();

    if (!name || isNaN(price) || isNaN(qty)) { toast('Name, price and quantity are required', 'err'); return; }

    const payload = { name, category: cat, price, qty, barcode, supplier };

    if (editingProductId) {
        await apiFetch(`/products/${editingProductId}`, { method: 'PUT', body: JSON.stringify(payload) });
        toast('Product updated');
        editingProductId = null;
        document.getElementById('saveProductBtn').textContent = 'Add Product';
        document.getElementById('cancelEditBtn').style.display = 'none';
    } else {
        await apiFetch('/products', { method: 'POST', body: JSON.stringify(payload) });
        toast('Product added');
    }
    clearProductForm(); 
    renderProducts(); 
    updateLowStockBadge();
}

async function editProduct(id) {
    const prods = await apiFetch('/products');
    const p = prods.find(x => x.id === id);
    if (!p) return;
    
    document.getElementById('pName').value = p.name;
    document.getElementById('pCat').value = p.category;
    document.getElementById('pPrice').value = p.price;
    document.getElementById('pQty').value = p.qty;
    document.getElementById('pBarcode').value = p.barcode || '';
    document.getElementById('pSupplier').value = p.supplier || '';
    editingProductId = id;
    
    document.getElementById('saveProductBtn').textContent = 'Update Product';
    document.getElementById('cancelEditBtn').style.display = '';
    document.getElementById('prodFormCard').scrollIntoView({ behavior: 'smooth' });
}

function cancelEdit() {
    editingProductId = null;
    clearProductForm();
    document.getElementById('saveProductBtn').textContent = 'Add Product';
    document.getElementById('cancelEditBtn').style.display = 'none';
}

async function deleteProduct(id) {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    await apiFetch(`/products/${id}`, { method: 'DELETE' });
    toast('Product deleted');
    renderProducts(); 
    updateLowStockBadge();
}

function clearProductForm() {
    ['pName','pPrice','pQty','pBarcode','pSupplier'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

/* ════════════════════════════════ INVENTORY ═══════════════════════════════ */
async function renderInventory() {
    const prods = await apiFetch('/products');
    if (!prods) return;
    prods.sort((a,b) => a.qty - b.qty);

    const invSel = document.getElementById('invProduct');
    if (invSel) invSel.innerHTML = prods.map(p => `<option value="${p.id}">${p.name} (Qty: ${p.qty})</option>`).join('');

    const low = prods.filter(p => p.qty <= LOW_STOCK_THRESHOLD);
    document.getElementById('invLowCount').textContent = low.length;
    document.getElementById('invTable').innerHTML = prods.map(p => {
        const status = p.qty === 0 ? '<span class="badge red">Out of Stock</span>'
                     : p.qty <= 5 ? '<span class="badge red">Critical</span>'
                     : p.qty <= 10 ? '<span class="badge amber">Low</span>'
                     : '<span class="badge green">Adequate</span>';
        return `<tr>
            <td style="color:var(--text-primary);font-weight:500">${p.name}</td>
            <td><span class="badge teal">${p.category}</span></td>
            <td><span class="mono" style="font-size:15px;font-weight:600;color:${p.qty<=5?'var(--red)':p.qty<=10?'var(--amber)':'var(--green)'}">${p.qty}</span></td>
            <td>${status}</td>
            <td>${p.supplier || '—'}</td>
        </tr>`;
    }).join('') || `<tr><td colspan="5" class="tbl-empty">No products</td></tr>`;

    const logs = await apiFetch('/products/inventory/logs');
    document.getElementById('invLogTable').innerHTML = logs ? logs.map(l => `
        <tr>
            <td>${new Date(l.created_at).toLocaleString('en-GH').slice(0,16)}</td>
            <td style="color:var(--text-primary)">${l.pname}</td>
            <td><span class="badge ${l.change_type==='sale'?'red':l.change_type==='initial'?'blue':'green'}">${l.change_type}</span></td>
            <td><span class="mono" style="color:${l.qty_change<0?'var(--red)':'var(--green)'}">${l.qty_change>0?'+':''}${l.qty_change}</span></td>
            <td class="text-muted text-sm">${l.note || ''}</td>
        </tr>`).join('') : `<tr><td colspan="5" class="tbl-empty">No log entries</td></tr>`;
}

async function adjustStock() {
    const pid = parseInt(document.getElementById('invProduct').value);
    const qty = parseInt(document.getElementById('invQtyAdj').value);
    const type = document.getElementById('invType').value;
    
    if (!pid || isNaN(qty) || qty <= 0) { toast('Select product and enter valid quantity', 'err'); return; }
    
    // We would ideally fetch the specific product here or validate backend, but we will let backend handle validation or assume enough logic
    await apiFetch(`/products/inventory/${pid}/adjust`, {
        method: 'POST',
        body: JSON.stringify({ 
            change_type: type, 
            qty_change: qty, 
            note: `Manual ${type} by ${currentUser.username}` 
        })
    });

    document.getElementById('invQtyAdj').value = '';
    toast(`Stock ${type === 'add' ? 'added' : 'removed'}: ${qty} units`);
    renderInventory(); 
    updateLowStockBadge();
}

/* ════════════════════════════════ CUSTOMERS ═══════════════════════════════ */
async function renderCustomers() {
    const custs = await apiFetch('/customers');
    if (!custs) return;
    
    document.getElementById('custCount').textContent = custs.length;
    document.getElementById('customerTable').innerHTML = custs.length ? custs.map(c => `
        <tr>
            <td><span class="mono text-muted">#${c.id}</span></td>
            <td style="color:var(--text-primary);font-weight:500">${c.name}</td>
            <td>${c.phone || '—'}</td>
            <td>${c.email || '—'}</td>
            <td>${c.address || '—'}</td>
            <td><span class="badge purple">${c.loyalty_points} pts</span></td>
            <td><span class="mono">${c.purchase_count}</span></td>
            <td><span class="mono" style="color:var(--green)">GHS ${Number(c.total_spent).toFixed(2)}</span></td>
        </tr>`).join('') : `<tr><td colspan="8" class="tbl-empty">No customers yet</td></tr>`;
}

async function saveCustomer() {
    const name = document.getElementById('cName').value.trim();
    if (!name) { toast('Name is required', 'err'); return; }
    
    await apiFetch('/customers', {
        method: 'POST',
        body: JSON.stringify({
            name,
            phone: document.getElementById('cPhone').value,
            email: document.getElementById('cEmail').value,
            address: document.getElementById('cAddress').value
        })
    });

    ['cName','cPhone','cEmail','cAddress'].forEach(id => { document.getElementById(id).value = ''; });
    toast('Customer registered');
    renderCustomers(); 
}

/* ════════════════════════════════ SALES ═══════════════════════════════════ */
async function renderSales() {
    const sales = await apiFetch('/sales');
    if (!sales) return;

    document.getElementById('salesTable').innerHTML = sales.length ? sales.map(s => `
        <tr>
            <td><span class="mono" style="color:var(--accent)">#${String(s.id).padStart(4,'0')}</span></td>
            <td>${new Date(s.created_at).toLocaleString('en-GH').slice(0,16)}</td>
            <td>${s.cashier}</td>
            <td>${s.customer_name}</td>
            <td><span class="mono" style="color:var(--green)">GHS ${Number(s.total).toFixed(2)}</span></td>
            <td><span class="badge ${payBadge(s.payment_method)}">${s.payment_method}</span></td>
            <td><button class="btn sm" onclick="viewSaleItems(${s.id}, '${s.customer_name}', ${s.total})">View Items</button></td>
        </tr>`).join('') : `<tr><td colspan="7" class="tbl-empty">No sales yet</td></tr>`;
}

async function viewSaleItems(saleId, customerName, total) {
    const items = await apiFetch(`/sales/${saleId}/items`);
    if (!items) return;

    alert(`Sale #${String(saleId).padStart(4,'0')} — ${customerName}\n\n` +
        items.map(i => `${i.product_name} ×${i.qty} @ GHS ${Number(i.unit_price).toFixed(2)} = GHS ${Number(i.line_total).toFixed(2)}`).join('\n') +
        `\n\nTotal: GHS ${Number(total).toFixed(2)}`);
}

/* ════════════════════════════════ REPORTS ════════════════════════════════ */
async function renderReports() {
    const r = await apiFetch('/reports');
    if (!r) return;

    document.getElementById('r-revenue').textContent = 'GHS ' + Number(r.allRevenue).toFixed(2);
    document.getElementById('r-txns').textContent    = r.allTxns;
    document.getElementById('r-avg').textContent     = 'GHS ' + Number(r.avgSale).toFixed(2);

    document.getElementById('r-top').innerHTML = r.topProds.length ? r.topProds.map(p => `
        <tr>
            <td style="color:var(--text-primary)">${p.product_name}</td>
            <td><span class="mono">${p.units}</span></td>
            <td><span class="mono" style="color:var(--green)">GHS ${Number(p.rev).toFixed(2)}</span></td>
        </tr>`).join('') : `<tr><td colspan="3" class="tbl-empty">No sales data</td></tr>`;

    document.getElementById('r-pay').innerHTML = r.payBreak.length ? r.payBreak.map(p => `
        <tr>
            <td><span class="badge ${payBadge(p.payment_method)}">${p.payment_method}</span></td>
            <td><span class="mono">${p.count}</span></td>
            <td><span class="mono" style="color:var(--accent)">GHS ${Number(p.total).toFixed(2)}</span></td>
        </tr>`).join('') : `<tr><td colspan="3" class="tbl-empty">No data</td></tr>`;

    document.getElementById('r-daily').innerHTML = r.dailySales.length ? r.dailySales.map(d => `
        <tr>
            <td><span class="mono">${new Date(d.day).toLocaleDateString()}</span></td>
            <td><span class="mono">${d.txns}</span></td>
            <td><span class="mono" style="color:var(--green)">GHS ${Number(d.rev).toFixed(2)}</span></td>
        </tr>`).join('') : `<tr><td colspan="3" class="tbl-empty">No data</td></tr>`;
}
