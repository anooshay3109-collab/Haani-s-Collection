/* =====================================================
   HAANI'S COLLECTION - Cart system
   Add to cart, quantity, totals, saved cart, checkout
===================================================== */

(function () {
    'use strict';

    /* ---------- SETTINGS (change these if needed) ---------- */

    // WhatsApp number that receives orders (country code, no + or spaces)
    var WHATSAPP_NUMBER = '923707706301';

    // Delivery charges in PKR. Use null if delivery is confirmed on WhatsApp.
    var DELIVERY_FEE = null;

    // Maximum quantity of one product in the cart
    var MAX_QTY = 10;

    var STORAGE_KEY = 'haanis_collection_cart_v1';

    /* ---------- HELPERS ---------- */

    function $(selector, root) {
        return (root || document).querySelector(selector);
    }

    function fmt(n) {
        return Number(n).toLocaleString('en-US') + ' PKR';
    }

    function toNumber(text) {
        var n = parseInt(String(text || '').replace(/[^\d]/g, ''), 10);
        return isNaN(n) ? 0 : n;
    }

    function slugify(text) {
        return String(text).toLowerCase().trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function esc(text) {
        var d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }

    /* ---------- STATE ---------- */

    var cart = load();

    function isValidItem(i) {
        return i && typeof i.id === 'string' &&
            typeof i.name === 'string' &&
            typeof i.price === 'number' &&
            typeof i.qty === 'number' && i.qty > 0;
    }

    function load() {
        try {
            var data = JSON.parse(localStorage.getItem(STORAGE_KEY));
            return Array.isArray(data) ? data.filter(isValidItem) : [];
        } catch (e) {
            return [];
        }
    }

    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
        } catch (e) { /* private mode: cart just won't persist */ }
    }

    /* ---------- ELEMENTS (filled on DOM ready) ---------- */

    var el = {};
    var lastFocus = null;
    var toastTimer = null;

    function grabElements() {
        el.toggle = $('#cart-toggle');
        el.count = $('#cart-count');
        el.overlay = $('#cart-overlay');
        el.drawer = $('#cart-drawer');
        el.close = $('#cart-close');
        el.headerCount = $('#cart-header-count');
        el.items = $('#cart-items');
        el.empty = $('#cart-empty');
        el.footer = $('#cart-footer');
        el.subtotal = $('#cart-subtotal');
        el.savedRow = $('#cart-saved-row');
        el.saved = $('#cart-saved');
        el.delivery = $('#cart-delivery');
        el.totalLabel = $('#cart-total-label');
        el.total = $('#cart-total');
        el.checkoutBtn = $('#checkout-btn');
        el.clear = $('#cart-clear');
        el.continueBtn = $('#cart-continue');
        el.modal = $('#checkout-modal');
        el.modalClose = $('#checkout-close');
        el.form = $('#checkout-form');
        el.formView = $('#checkout-form-view');
        el.successView = $('#checkout-success-view');
        el.summary = $('#checkout-summary');
        el.waLink = $('#checkout-wa-link');
        el.done = $('#checkout-done');
        el.toast = $('#cart-toast');
    }

    /* ---------- TOTALS ---------- */

    function totals() {
        var subtotal = 0, original = 0, qty = 0;
        cart.forEach(function (i) {
            subtotal += i.price * i.qty;
            original += (i.oldPrice > i.price ? i.oldPrice : i.price) * i.qty;
            qty += i.qty;
        });
        var delivery = (typeof DELIVERY_FEE === 'number') ? DELIVERY_FEE : 0;
        return {
            qty: qty,
            subtotal: subtotal,
            saved: original - subtotal,
            delivery: delivery,
            total: subtotal + delivery
        };
    }

    function deliveryText() {
        if (typeof DELIVERY_FEE !== 'number') return 'Confirmed on WhatsApp';
        return DELIVERY_FEE === 0 ? 'Free' : fmt(DELIVERY_FEE);
    }

    /* ---------- RENDER ---------- */

    function render() {
        var t = totals();

        // navbar badge
        el.count.textContent = t.qty;
        el.headerCount.textContent = '(' + t.qty + ')';

        var hasItems = cart.length > 0;
        el.items.style.display = hasItems ? '' : 'none';
        el.footer.style.display = hasItems ? '' : 'none';
        el.empty.style.display = hasItems ? 'none' : 'flex';

        el.items.innerHTML = cart.map(function (i) {
            var oldPrice = i.oldPrice > i.price
                ? '<del>' + fmt(i.oldPrice) + '</del>' : '';
            return (
                '<div class="cart-item" data-id="' + esc(i.id) + '">' +
                    '<img class="cart-item-img" src="' + esc(i.image) + '" alt="' + esc(i.name) + '">' +
                    '<div class="cart-item-info">' +
                        '<div class="cart-item-top">' +
                            '<h4 class="cart-item-name">' + esc(i.name) + '</h4>' +
                            '<button type="button" class="cart-item-remove" data-action="remove" aria-label="Remove ' + esc(i.name) + '">' +
                                '<i class="fa-solid fa-trash-can"></i>' +
                            '</button>' +
                        '</div>' +
                        '<div class="cart-item-price">' + oldPrice + fmt(i.price) + '</div>' +
                        '<div class="cart-item-bottom">' +
                            '<div class="qty-box">' +
                                '<button type="button" data-action="dec" aria-label="Decrease quantity">&minus;</button>' +
                                '<span aria-live="polite">' + i.qty + '</span>' +
                                '<button type="button" data-action="inc" aria-label="Increase quantity"' +
                                    (i.qty >= MAX_QTY ? ' disabled' : '') + '>+</button>' +
                            '</div>' +
                            '<div class="cart-line-total">' + fmt(i.price * i.qty) + '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>'
            );
        }).join('');

        el.subtotal.textContent = fmt(t.subtotal);
        el.savedRow.style.display = t.saved > 0 ? '' : 'none';
        el.saved.textContent = '- ' + fmt(t.saved);
        el.delivery.textContent = deliveryText();
        el.totalLabel.textContent = typeof DELIVERY_FEE === 'number' ? 'Total' : 'Total (excl. delivery)';
        el.total.textContent = fmt(t.total);

        renderSummary();
    }

    function renderSummary() {
        if (!el.summary) return;
        var t = totals();
        el.summary.innerHTML = cart.map(function (i) {
            return '<div class="sum-line"><span>' + esc(i.name) + ' &times; ' + i.qty +
                '</span><span>' + fmt(i.price * i.qty) + '</span></div>';
        }).join('') +
            '<div class="sum-line"><span>Delivery</span><span>' + esc(deliveryText()) + '</span></div>' +
            '<div class="sum-line sum-total"><span>Total</span><span>' + fmt(t.total) + '</span></div>';
    }

    /* ---------- CART ACTIONS ---------- */

    function productFromButton(btn) {
        var card = btn.closest('.necklace-card, .handcuff-card');
        if (!card) return null;

        var nameEl = card.querySelector('h3');
        var priceEl = card.querySelector('.product-price span, .handcuff-price span');
        var oldEl = card.querySelector('.product-price del, .handcuff-price del');
        var imgEl = card.querySelector('img');
        if (!nameEl || !priceEl) return null;

        var name = nameEl.textContent.trim();
        return {
            id: slugify(name),
            name: name,
            price: toNumber(priceEl.textContent),
            oldPrice: oldEl ? toNumber(oldEl.textContent) : 0,
            image: imgEl ? imgEl.getAttribute('src') : ''
        };
    }

    function findItem(id) {
        for (var k = 0; k < cart.length; k++) {
            if (cart[k].id === id) return cart[k];
        }
        return null;
    }

    // returns true if the product was added or its quantity increased
    function addItem(product, increase) {
        var existing = findItem(product.id);
        if (existing) {
            if (!increase) return true;
            if (existing.qty >= MAX_QTY) {
                showToast('Maximum ' + MAX_QTY + ' of one item per order');
                return false;
            }
            existing.qty += 1;
        } else {
            product.qty = 1;
            cart.push(product);
        }
        save();
        render();
        bumpBadge();
        return true;
    }

    function changeQty(id, delta) {
        var item = findItem(id);
        if (!item) return;
        item.qty += delta;
        if (item.qty > MAX_QTY) item.qty = MAX_QTY;
        if (item.qty <= 0) {
            removeItem(id);
            return;
        }
        save();
        render();
    }

    function removeItem(id) {
        cart = cart.filter(function (i) { return i.id !== id; });
        save();
        render();
        if (!cart.length && isOpen(el.modal)) closeCheckout();
    }

    function clearCart() {
        cart = [];
        save();
        render();
    }

    /* ---------- UI: badge, toast, button feedback ---------- */

    function bumpBadge() {
        el.count.classList.remove('bump');
        void el.count.offsetWidth; // restart animation
        el.count.classList.add('bump');
    }

    function showToast(message) {
        el.toast.textContent = message;
        el.toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            el.toast.classList.remove('show');
        }, 2200);
    }

    function flashButton(btn) {
        if (btn.dataset.busy) return;
        btn.dataset.busy = '1';
        var original = btn.textContent;
        btn.textContent = 'Added ✓';
        btn.classList.add('added');
        setTimeout(function () {
            btn.textContent = original;
            btn.classList.remove('added');
            delete btn.dataset.busy;
        }, 1100);
    }

    /* ---------- DRAWER / MODAL OPEN + CLOSE ---------- */

    function isOpen(node) {
        return node && node.classList.contains('open');
    }

    function syncScrollLock() {
        var locked = isOpen(el.drawer) || isOpen(el.modal);
        document.body.classList.toggle('cart-lock', locked);
    }

    function openCart() {
        lastFocus = document.activeElement;
        el.drawer.classList.add('open');
        el.overlay.classList.add('open');
        el.drawer.setAttribute('aria-hidden', 'false');
        syncScrollLock();
        setTimeout(function () { el.close.focus(); }, 50);
    }

    function closeCart() {
        el.drawer.classList.remove('open');
        el.overlay.classList.remove('open');
        el.drawer.setAttribute('aria-hidden', 'true');
        syncScrollLock();
        if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    function openCheckout() {
        if (!cart.length) {
            showToast('Your cart is empty');
            return;
        }
        resetCheckoutView();
        renderSummary();
        el.modal.classList.add('open');
        el.modal.setAttribute('aria-hidden', 'false');
        syncScrollLock();
        setTimeout(function () {
            var first = $('#co-name');
            if (first) first.focus();
        }, 80);
    }

    function closeCheckout() {
        el.modal.classList.remove('open');
        el.modal.setAttribute('aria-hidden', 'true');
        syncScrollLock();
    }

    function resetCheckoutView() {
        el.formView.hidden = false;
        el.successView.hidden = true;
    }

    /* ---------- CHECKOUT FORM ---------- */

    function setError(input, message) {
        var field = input.closest('.field');
        var err = field.querySelector('.field-error');
        if (message) {
            field.classList.add('invalid');
            err.textContent = message;
        } else {
            field.classList.remove('invalid');
            err.textContent = '';
        }
        return !message;
    }

    function validateForm() {
        var f = el.form.elements;
        var ok = true;

        var name = f.name.value.trim();
        ok = setError(f.name, name.length < 2 ? 'Please enter your full name' : '') && ok;

        var phoneDigits = f.phone.value.replace(/[\s\-()+]/g, '');
        var phoneOk = /^\d{10,13}$/.test(phoneDigits);
        ok = setError(f.phone, phoneOk ? '' : 'Please enter a valid phone number') && ok;

        ok = setError(f.city, f.city.value.trim().length < 2 ? 'Please enter your city' : '') && ok;
        ok = setError(f.address, f.address.value.trim().length < 8 ? 'Please enter your full address' : '') && ok;

        if (!ok) {
            var firstBad = el.form.querySelector('.field.invalid input, .field.invalid textarea');
            if (firstBad) firstBad.focus();
        }
        return ok;
    }

    function buildWhatsAppMessage() {
        var f = el.form.elements;
        var t = totals();
        var lines = [];

        lines.push("*NEW ORDER - HAANI'S COLLECTION*");
        lines.push('');
        lines.push('*Name:* ' + f.name.value.trim());
        lines.push('*Phone:* ' + f.phone.value.trim());
        lines.push('*City:* ' + f.city.value.trim());
        lines.push('*Address:* ' + f.address.value.trim());
        lines.push('');
        lines.push('*Items:*');
        cart.forEach(function (i, idx) {
            lines.push((idx + 1) + '. ' + i.name + ' x ' + i.qty + ' = ' + fmt(i.price * i.qty));
        });
        lines.push('');
        lines.push('Subtotal: ' + fmt(t.subtotal));
        lines.push('Delivery: ' + deliveryText());
        lines.push('*Total: ' + fmt(t.total) + '*');

        var note = f.note.value.trim();
        if (note) {
            lines.push('');
            lines.push('Note: ' + note);
        }
        return lines.join('\n');
    }

    function onSubmit(e) {
        e.preventDefault();
        if (!cart.length) return;
        if (!validateForm()) return;

        var url = 'https://wa.me/' + WHATSAPP_NUMBER +
            '?text=' + encodeURIComponent(buildWhatsAppMessage());

        el.waLink.setAttribute('href', url);
        window.open(url, '_blank', 'noopener');

        el.formView.hidden = true;
        el.successView.hidden = false;
        el.modal.querySelector('.checkout-box').scrollTop = 0;
    }

    function onDone() {
        clearCart();
        el.form.reset();
        closeCheckout();
        closeCart();
        showToast('Thank you for shopping with us!');
    }

    /* ---------- EVENTS ---------- */

    function bindEvents() {

        // Add to Cart / Buy Now (works for all current and future product cards)
        document.addEventListener('click', function (e) {
            var addBtn = e.target.closest('.add-cart');
            var buyBtn = e.target.closest('.buy-now');
            var btn = addBtn || buyBtn;
            if (!btn) return;

            var product = productFromButton(btn);
            if (!product) return;

            if (addBtn) {
                if (addItem(product, true)) {
                    flashButton(addBtn);
                    showToast(product.name + ' added to cart');
                }
            } else {
                // Buy Now: make sure it is in the cart, then go straight to checkout
                addItem(product, false);
                openCheckout();
            }
        });

        // Navbar cart icon
        el.toggle.addEventListener('click', function (e) {
            e.preventDefault();
            openCart();
        });

        // Drawer controls
        el.close.addEventListener('click', closeCart);
        el.overlay.addEventListener('click', closeCart);
        el.continueBtn.addEventListener('click', closeCart);
        el.clear.addEventListener('click', function () {
            clearCart();
            showToast('Cart cleared');
        });
        el.checkoutBtn.addEventListener('click', openCheckout);

        // Quantity / remove buttons inside the drawer
        el.items.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-action]');
            if (!btn) return;
            var row = btn.closest('.cart-item');
            if (!row) return;
            var id = row.getAttribute('data-id');
            var action = btn.getAttribute('data-action');
            if (action === 'inc') changeQty(id, 1);
            if (action === 'dec') changeQty(id, -1);
            if (action === 'remove') removeItem(id);
        });

        // Checkout modal
        el.modalClose.addEventListener('click', closeCheckout);
        el.modal.addEventListener('click', function (e) {
            if (e.target === el.modal) closeCheckout();
        });
        el.form.addEventListener('submit', onSubmit);
        el.form.addEventListener('input', function (e) {
            var field = e.target.closest('.field');
            if (field && field.classList.contains('invalid')) {
                field.classList.remove('invalid');
            }
        });
        el.done.addEventListener('click', onDone);

        // Escape closes the top-most panel
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            if (isOpen(el.modal)) closeCheckout();
            else if (isOpen(el.drawer)) closeCart();
        });

        // Keep several open tabs in sync
        window.addEventListener('storage', function (e) {
            if (e.key === STORAGE_KEY) {
                cart = load();
                render();
            }
        });
    }

    /* ---------- START ---------- */

    function init() {
        grabElements();
        if (!el.drawer || !el.count || !el.toggle) return; // cart markup missing
        bindEvents();
        render();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
