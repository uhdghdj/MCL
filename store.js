
/* ==========================================================
   MCL STORE - LOGIC & SUPABASE INTEGRATION
   ========================================================== */

// 1. إعداد الاتصال بمشروع Supabase
const SUPABASE_URL = 'https://lpunsnvraeylwuugjmwl.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_vcPbI8K3XNmrLn99ZIT16w_p5K36USH';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// 2. إعدادات المتجر العامة
const STORE_CONFIG = {
  SHIPPING_CAIRO_GIZA: 125,      // مصاريف الشحن داخل القاهرة والجيزة بالجنيه
  SHIPPING_OTHER_GOVS: 135,      // مصاريف الشحن لبقية المحافظات بالجنيه
  BUY_TWO_DISCOUNT_PERCENT: 10,  // خصم 10٪ عند شراء قطعتين أو أكثر
  LOW_STOCK_LIMIT: 5,            // حد التنبيه بانخفاض المخزون
  ADMIN_EMAIL: 'admin@example.com' // ← اكتب هنا إيميل الأدمن اللي هيوصله الطلبات
};

// سعر القطعة = نفس السعر المعروض في الصفحة الرئيسية
function getUnitPrice(prod) {
  return Number(prod.selling_price) || 0;
}

// تحديث أسعار السلة المحفوظة لتطابق السعر الحالي المعروض
function syncCartPrices() {
  if (typeof cart === 'undefined' || !Array.isArray(cart)) return;
  let changed = false;
  cart.forEach(item => {
    const p = (productsList || []).find(x => x.id === item.product_id);
    if (p) {
      const price = getUnitPrice(p);
      if (item.unit_price !== price) { item.unit_price = price; changed = true; }
    }
  });
  if (changed) { try { persistCart(); } catch (e) {} }
}

// إرسال تفاصيل الطلب على إيميل الأدمن
async function sendOrderEmailToAdmin(order, items) {
  if (!STORE_CONFIG.ADMIN_EMAIL || STORE_CONFIG.ADMIN_EMAIL === 'admin@example.com') {
    console.warn('ADMIN_EMAIL غير مضبوط - لم يتم إرسال إيميل الطلب');
    return;
  }
  const lines = items.map(i =>
    `- ${i.product_name}${i.color_name ? ' / ' + i.color_name : ''}${i.size_name ? ' / ' + i.size_name : ''} × ${i.quantity} = ${i.unit_price * i.quantity} ج.م`
  ).join('\n');
  try {
    const res = await fetch('https://formsubmit.co/ajax/' + encodeURIComponent(STORE_CONFIG.ADMIN_EMAIL), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        _subject: `طلب جديد ${order.order_number ? '#' + order.order_number : ''} - MCL`,
        _template: 'table',
        _captcha: 'false',
        'رقم الطلب': order.order_number || order.id || '',
        'الاسم': order.customer_name || '',
        'الموبايل': order.customer_phone || '',
        'الإيميل': order.customer_email || '',
        'المحافظة': order.governorate || order.shipping_governorate || '',
        'العنوان': order.shipping_address || order.address || '',
        'المنتجات': lines,
        'المجموع': order.subtotal,
        'الخصم': order.discount_amount,
        'الشحن': order.shipping_cost,
        'الإجمالي': order.total_amount
      })
    });
    if (!res.ok) console.error('فشل إرسال إيميل الطلب', res.status, await res.text());
  } catch (err) {
    console.error('فشل إرسال إيميل الطلب', err);
  }
}

let selectedGovernorate = '';

function getShippingCost(governorate, subtotal) {
  if (!governorate) return null;
  const gov = String(governorate).trim();
  const isCairoOrGiza = ['القاهرة', 'الجيزة', 'Cairo', 'Giza'].some(g => gov.includes(g));
  return isCairoOrGiza ? STORE_CONFIG.SHIPPING_CAIRO_GIZA : STORE_CONFIG.SHIPPING_OTHER_GOVS;
}

function onGovernorateChange(val) {
  selectedGovernorate = val || '';
  // مزامنة القائمتين (في السلة وفي نافذة الدفع)
  const cartSelect = getElem('cartGovernorateSelect');
  if (cartSelect && cartSelect.value !== selectedGovernorate) {
    cartSelect.value = selectedGovernorate;
  }
  const modalSelect = getElem('governorateSelect');
  if (modalSelect && modalSelect.value !== selectedGovernorate) {
    modalSelect.value = selectedGovernorate;
  }
  calculateTotals();
}

const MCL_FALLBACK_IMAGES = {
  blackTee: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%231a1a1a'/%3E%3Cpath d='M150 160h100v80H150z' fill='%23333333'/%3E%3Ctext x='200' y='210' fill='%23777777' font-size='18' text-anchor='middle' font-family='sans-serif'%3EMCL STORE%3C/text%3E%3C/svg%3E",
  creamTee: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%231a1a1a'/%3E%3Cpath d='M150 160h100v80H150z' fill='%23333333'/%3E%3Ctext x='200' y='210' fill='%23777777' font-size='18' text-anchor='middle' font-family='sans-serif'%3EMCL STORE%3C/text%3E%3C/svg%3E",
  hoodie: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%231a1a1a'/%3E%3Cpath d='M150 160h100v80H150z' fill='%23333333'/%3E%3Ctext x='200' y='210' fill='%23777777' font-size='18' text-anchor='middle' font-family='sans-serif'%3EMCL STORE%3C/text%3E%3C/svg%3E",
  cargo: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%231a1a1a'/%3E%3Cpath d='M150 160h100v80H150z' fill='%23333333'/%3E%3Ctext x='200' y='210' fill='%23777777' font-size='18' text-anchor='middle' font-family='sans-serif'%3EMCL STORE%3C/text%3E%3C/svg%3E"
};

// 3. حالة التطبيق (State)
let productsList = [];
let productImagesMap = {};
let productColorsMap = {};
let productSizesMap = {};
let productVariantsMap = {};

let activeProduct = null;
let activeColor = null;
let activeSize = null;
let activeQuantity = 1;
let activeCategory = 'all';
let MCL_LANG = localStorage.getItem('mcl_language') || 'ar';

let appliedCouponData = null;

// تحميل السلة من localStorage
let cart = [];
try {
  cart = JSON.parse(localStorage.getItem('mcl_cart')) || [];
} catch (e) {
  cart = [];
}

const persistCart = () => localStorage.setItem('mcl_cart', JSON.stringify(cart));

// 4. دوال مساعدة (Helpers)
const formatEGP = (amount) => MCL_LANG === 'en'
  ? `${Number(amount || 0).toLocaleString('en-US')} EGP`
  : `${Number(amount || 0).toLocaleString('ar-EG')} ج.م`;
const getElem = (id) => document.getElementById(id);

const tr = (ar, en) => MCL_LANG === 'en' ? en : ar;

function initWinterCountdown() {
  const countdown = getElem('winterCountdown');
  if (!countdown) return;

  const targetTime = Date.parse(countdown.dataset.targetTime);
  const hoursEl = getElem('winterHours');
  const minutesEl = getElem('winterMinutes');
  const secondsEl = getElem('winterSeconds');
  if (!Number.isFinite(targetTime)) {
    document.documentElement.classList.remove('winter-drop-active');
    countdown.hidden = true;
    return;
  }

  let intervalId;
  const updateCountdown = () => {
    const remaining = targetTime - Date.now();
    if (remaining <= 0) {
      countdown.hidden = true;
      document.documentElement.classList.remove('winter-drop-active');
      clearInterval(intervalId);
      return;
    }

    hoursEl.textContent = String(Math.floor(remaining / 3600000)).padStart(2, '0');
    minutesEl.textContent = String(Math.floor((remaining % 3600000) / 60000)).padStart(2, '0');
    secondsEl.textContent = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
  };

  updateCountdown();
  if (!countdown.hidden) {
    intervalId = setInterval(updateCountdown, 1000);
  }
}

function showToast(message) {
  const toast = getElem('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('active');
  setTimeout(() => toast.classList.remove('active'), 2500);
}

function openModal(id) {
  const el = getElem(id);
  if (el) {
    el.classList.add('active');
    document.body.classList.add('no-scroll');
  }
}

function closeModal(id) {
  const el = getElem(id);
  if (el) {
    el.classList.remove('active');
    if (!document.querySelector('.modal.active') && !getElem('cartDrawer').classList.contains('active')) {
      document.body.classList.remove('no-scroll');
    }
  }
}

function goHome(e) {
  if (e) e.preventDefault();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function scrollToProducts(e) {
  if (e) e.preventDefault();
  getElem('products').scrollIntoView({ behavior: 'smooth' });
}

function focusSearch() {
  const input = getElem('productSearch');
  if (!input) return;
  getElem('products').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => input.focus(), 450);
}

function setCategory(category, button) {
  activeCategory = category;
  document.querySelectorAll('.filter-chip').forEach(chip => chip.classList.remove('active'));
  if (button) button.classList.add('active');
  renderGrid();
}

// 5. جلب المنتجات وبياناتها من Supabase
async function initStore() {
  updateCartBadge();
  await fetchProducts();
}

async function fetchProducts() {
  const grid = getElem('productsGrid');
  try {
    // جلب المنتجات النشطة فقط
    const { data: prods, error: pError } = await supabaseClient
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (pError) throw pError;
    productsList = prods || [];

    if (!productsList.length) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px 0; color: var(--text-muted);">لا توجد منتجات معروضة حاليًا في المتجر.</div>';
      return;
    }

    const prodIds = productsList.map(p => p.id);

    // جلب الصور والألوان والمقاسات والـ Variants دفعة واحدة
    const [imagesRes, colorsRes, sizesRes, variantsRes] = await Promise.all([
      supabaseClient.from('product_images').select('*').in('product_id', prodIds).order('sort_order', { ascending: true }),
      supabaseClient.from('product_colors').select('*').in('product_id', prodIds),
      supabaseClient.from('product_sizes').select('*').in('product_id', prodIds),
      supabaseClient.from('product_variants').select('*').in('product_id', prodIds).eq('is_active', true)
    ]);

    productImagesMap = {};
    (imagesRes.data || []).forEach(img => {
      if (!productImagesMap[img.product_id]) productImagesMap[img.product_id] = [];
      productImagesMap[img.product_id].push(img);
    });

    productColorsMap = {};
    (colorsRes.data || []).forEach(c => {
      if (!productColorsMap[c.product_id]) productColorsMap[c.product_id] = [];
      productColorsMap[c.product_id].push(c);
    });

    productSizesMap = {};
    (sizesRes.data || []).forEach(s => {
      if (!productSizesMap[s.product_id]) productSizesMap[s.product_id] = [];
      productSizesMap[s.product_id].push(s);
    });

    productVariantsMap = {};
    (variantsRes.data || []).forEach(v => {
      if (!productVariantsMap[v.product_id]) productVariantsMap[v.product_id] = [];
      productVariantsMap[v.product_id].push(v);
    });

    renderGrid();
  } catch (err) {
    console.error('فشل في جلب المنتجات من Supabase:', err);
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px 0; color: var(--danger);">حدث خطأ في تحميل المنتجات. تأكد من إعدادات قاعدة البيانات.</div>';
  }
}

// 6. عرض شبكة المنتجات (Products Grid)
function calculateProductStock(productId) {
  const vars = productVariantsMap[productId] || [];
  if (vars.length > 0) {
    return vars.reduce((sum, item) => sum + (Number(item.stock_quantity) || 0), 0);
  }
  const prod = productsList.find(p => p.id === productId);
  return prod ? (Number(prod.stock_quantity) || 0) : 0;
}

function getProductSearchText(product) {
  return [
    product.name,
    product.description,
    product.category,
    product.category_name,
    product.collection,
    product.product_type,
    product.type
  ].filter(Boolean).join(' ').toLowerCase();
}

function matchesCategory(product, category) {
  if (category === 'all') return true;
  const text = getProductSearchText(product);
  if (category === 'tshirt') return /t-?shirt|tee|shirt|تيشيرت|تشيرت/.test(text);
  if (category === 'hoodie') return /hoodie|sweat|هودي|سويت/.test(text);
  if (category === 'essential') return /essential|basic|أساسي|اساسي|يومي/.test(text);
  return true;
}

function getFallbackImage(product) {
  const text = getProductSearchText(product);
  if (/hoodie|sweat|هودي|سويت/.test(text)) return MCL_FALLBACK_IMAGES.hoodie;
  if (/cargo|pant|trouser|بنطلون|كارغو/.test(text)) return MCL_FALLBACK_IMAGES.cargo;
  if (/cream|white|off.?white|كريمي|أبيض|ابيض/.test(text)) return MCL_FALLBACK_IMAGES.creamTee;
  return MCL_FALLBACK_IMAGES.blackTee;
}

function renderGrid() {
  const sort = getElem('sortSelect').value;
  const search = (getElem('productSearch')?.value || '').trim().toLowerCase();
  let items = productsList.filter(product => matchesCategory(product, activeCategory));
  if (search) items = items.filter(product => getProductSearchText(product).includes(search));

  if (sort === 'low') {
    items.sort((a, b) => a.selling_price - b.selling_price);
  } else if (sort === 'high') {
    items.sort((a, b) => b.selling_price - a.selling_price);
  } else {
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  const grid = getElem('productsGrid');
  const countEl = getElem('productCount');
  if (countEl) countEl.textContent = `${items.length} ${MCL_LANG === 'en' ? (items.length === 1 ? 'ITEM' : 'ITEMS') : 'منتج'}`;
  if (!items.length) {
    grid.innerHTML = `<div class="empty-state">${tr('مفيش قطع مطابقة للبحث الحالي. جرّب تصنيف تاني.', 'No pieces match your search. Try another filter.')}</div>`;
    return;
  }
  grid.innerHTML = items.map(p => {
    const images = productImagesMap[p.id] || [];
    const coverImage = images.find(i => i.is_cover) || images[0];
    const imageSource = coverImage ? coverImage.image_url : getFallbackImage(p);
    const totalStock = calculateProductStock(p.id);
    const hasDiscount = p.compare_at_price && p.compare_at_price > p.selling_price;
    const discountPercent = hasDiscount ? Math.round(((p.compare_at_price - p.selling_price) / p.compare_at_price) * 100) : 0;
    const colors = productColorsMap[p.id] || [];

    return `
      <div class="product-card" onclick="openProductDetails('${p.id}')">
        <div class="card-image-box">
          <div class="card-badges">
            ${p.is_featured ? `<span class="badge badge-featured">${tr('مميز', 'Featured')}</span>` : ''}
            ${hasDiscount ? `<span class="badge badge-discount">-${discountPercent}%</span>` : ''}
            ${totalStock === 0 ? `<span class="badge badge-out">${tr('نفذت الكمية', 'Sold out')}</span>` : ''}
          </div>
          ${imageSource 
             ? `<img class="card-image" src="${imageSource}" alt="${p.name}" loading="lazy">`
            : `<div class="card-placeholder">👕</div>`}
          <button class="quick-view" type="button" onclick="event.stopPropagation(); openProductDetails('${p.id}')" aria-label="عرض تفاصيل ${p.name}">↗</button>
        </div>
        <div class="card-content">
          <h3 class="card-title">${p.name}</h3>
          <div class="card-prices">
            <span class="price-current">${formatEGP(p.selling_price)}</span>
            ${hasDiscount ? `<span class="price-old">${formatEGP(p.compare_at_price)}</span>` : ''}
          </div>
          ${colors.length ? `
            <div class="card-colors">
              ${colors.slice(0, 5).map(c => `<span class="card-color-dot" style="background:${c.hex_code}"></span>`).join('')}
            </div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// 7. تفاصيل المنتج المنبثقة (Product Details Modal)
function openProductDetails(productId) {
  const prod = productsList.find(p => p.id === productId);
  if (!prod) return;

  activeProduct = prod;
  activeQuantity = 1;
  getElem('pmQty').textContent = '1';

  getElem('pmName').textContent = prod.name;
  getElem('pmCategory').textContent = (prod.category_name || prod.collection || 'MCL ESSENTIALS').toString().toUpperCase();
  getElem('pmDesc').textContent = prod.description || 'لا يوجد وصف إضافي لهذا المنتج.';

  const hasDiscount = prod.compare_at_price && prod.compare_at_price > prod.selling_price;
  getElem('pmPrice').innerHTML = `
    <span class="price-current" style="font-size: 1.5rem;">${formatEGP(prod.selling_price)}</span>
    ${hasDiscount ? `<span class="price-old">${formatEGP(prod.compare_at_price)}</span>` : ''}
  `;

  // المعرض
  const images = productImagesMap[prod.id] || [];
  const gallery = getElem('pmGallery');
  if (images.length) {
    const mainImg = images.find(i => i.is_cover) || images[0];
    gallery.innerHTML = `
      <img id="pmMainImage" class="gallery-main" src="${mainImg.image_url}" alt="${prod.name}">
      ${images.length > 1 ? `
        <div class="gallery-thumbs">
          ${images.map((img, idx) => `
            <img class="gallery-thumb ${img.image_url === mainImg.image_url ? 'active' : ''}" 
                 src="${img.image_url}" 
                 onclick="switchGalleryImage('${img.image_url}', this)">
          `).join('')}
        </div>
      ` : ''}
    `;
  } else {
    gallery.innerHTML = `<img id="pmMainImage" class="gallery-main" src="${getFallbackImage(prod)}" alt="${prod.name}">`;
  }

  // الألوان
  const colors = productColorsMap[prod.id] || [];
  const colorsWrap = getElem('pmColorsWrap');
  if (colors.length) {
    colorsWrap.style.display = 'block';
    getElem('pmColors').innerHTML = colors.map(c => `
      <button type="button" class="color-btn" onclick="selectColor('${c.id}')" data-color-id="${c.id}">
        <span class="color-btn-dot" style="background:${c.hex_code}"></span>
        <span>${c.name}</span>
      </button>
    `).join('');
    selectColor(colors[0].id);
  } else {
    colorsWrap.style.display = 'none';
    activeColor = null;
    getElem('selectedColorName').textContent = '';
  }

  // المقاسات
  const sizes = productSizesMap[prod.id] || [];
  const sizesWrap = getElem('pmSizesWrap');
  if (sizes.length) {
    sizesWrap.style.display = 'block';
    getElem('pmSizes').innerHTML = sizes.map(s => `
      <button type="button" class="size-btn" onclick="selectSize('${s.id}')" data-size-id="${s.id}">
        ${s.name}
      </button>
    `).join('');
    selectSize(sizes[0].id);
  } else {
    sizesWrap.style.display = 'none';
    activeSize = null;
    getElem('selectedSizeName').textContent = '';
  }

  updateVariantStatus();
  openModal('productModal');
}

function switchGalleryImage(url, thumbEl) {
  getElem('pmMainImage').src = url;
  document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
  if (thumbEl) thumbEl.classList.add('active');
}

function selectColor(colorId) {
  const colors = productColorsMap[activeProduct.id] || [];
  activeColor = colors.find(c => c.id === colorId);
  getElem('selectedColorName').textContent = activeColor ? activeColor.name : '';
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-color-id') === colorId);
  });
  updateVariantStatus();
}

function selectSize(sizeId) {
  const sizes = productSizesMap[activeProduct.id] || [];
  activeSize = sizes.find(s => s.id === sizeId);
  getElem('selectedSizeName').textContent = activeSize ? activeSize.name : '';
  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-size-id') === sizeId);
  });
  updateVariantStatus();
}

function changeQty(diff) {
  activeQuantity = Math.max(1, activeQuantity + diff);
  getElem('pmQty').textContent = activeQuantity;
}

function getActiveVariant() {
  if (!activeProduct) return null;
  const variants = productVariantsMap[activeProduct.id] || [];
  if (!variants.length) return null;
  return variants.find(v => {
    const colorMatch = activeColor ? v.color_id === activeColor.id : true;
    const sizeMatch = activeSize ? v.size_id === activeSize.id : true;
    return colorMatch && sizeMatch;
  });
}

function updateVariantStatus() {
  const statusEl = getElem('pmStock');
  const addBtn = getElem('addToCartBtn');
  const variants = productVariantsMap[activeProduct.id] || [];

  if (variants.length > 0) {
    const variant = getActiveVariant();
    if (!variant || (variant.stock_quantity || 0) <= 0) {
      statusEl.textContent = tr('❌ المقاس أو اللون المحدد نفذت كميته من المخزون', '❌ This color or size is out of stock');
      statusEl.className = 'stock-status stock-out';
      addBtn.disabled = true;
      addBtn.textContent = tr('نفذت الكمية', 'Sold out');
    } else if (variant.stock_quantity <= STORE_CONFIG.LOW_STOCK_LIMIT) {
      statusEl.textContent = tr(`⚠️ متبقي ${variant.stock_quantity} قطع فقط من هذا المقاس واللون!`, `⚠️ Only ${variant.stock_quantity} left in this size and color!`);
      statusEl.className = 'stock-status stock-low';
      addBtn.disabled = false;
      addBtn.textContent = tr('إضافة إلى السلة', 'Add to cart');
    } else {
      statusEl.textContent = tr(`✓ متوفر في المخزون (${variant.stock_quantity} قطعة)`, `✓ In stock (${variant.stock_quantity} units)`);
      statusEl.className = 'stock-status stock-ok';
      addBtn.disabled = false;
      addBtn.textContent = tr('إضافة إلى السلة', 'Add to cart');
    }
  } else {
    const qty = activeProduct.stock_quantity || 0;
    if (qty <= 0) {
      statusEl.textContent = tr('❌ نفذت الكمية بالكامل', '❌ Completely out of stock');
      statusEl.className = 'stock-status stock-out';
      addBtn.disabled = true;
      addBtn.textContent = tr('نفذت الكمية', 'Sold out');
    } else if (qty <= STORE_CONFIG.LOW_STOCK_LIMIT) {
      statusEl.textContent = tr(`⚠️ متبقي ${qty} قطع فقط!`, `⚠️ Only ${qty} left!`);
      statusEl.className = 'stock-status stock-low';
      addBtn.disabled = false;
      addBtn.textContent = tr('إضافة إلى السلة', 'Add to cart');
    } else {
      statusEl.textContent = tr(`✓ متوفر في المخزون (${qty} قطعة)`, `✓ In stock (${qty} units)`);
      statusEl.className = 'stock-status stock-ok';
      addBtn.disabled = false;
      addBtn.textContent = tr('إضافة إلى السلة', 'Add to cart');
    }
  }
}

// 8. منطق سلة التسوق (Shopping Cart)
function addToCart() {
  const prod = activeProduct;
  const variants = productVariantsMap[prod.id] || [];
  let variant = null;
  let colorName = null;
  let sizeName = null;

  if (variants.length > 0) {
    variant = getActiveVariant();
    if (!variant || (variant.stock_quantity || 0) <= 0) {
      showToast('هذا التحديد غير متوفر حاليًا');
      return;
    }
    colorName = activeColor ? activeColor.name : null;
    sizeName = activeSize ? activeSize.name : null;
  }

  const unitPrice = getUnitPrice(prod);
  const unitCost = variant ? (variant.cost_price ?? prod.cost_price ?? 0) : (prod.cost_price ?? 0);
  const sku = variant ? variant.sku : prod.sku;
  const maxAvailable = variant ? variant.stock_quantity : prod.stock_quantity;
  const itemKey = variant ? `var_${variant.id}` : `prod_${prod.id}`;

  const images = productImagesMap[prod.id] || [];
  const cover = images.find(i => i.is_cover) || images[0];
  const imageUrl = cover ? cover.image_url : getFallbackImage(prod);

  const existingIndex = cart.findIndex(i => i.itemKey === itemKey);
  if (existingIndex > -1) {
    const targetQty = cart[existingIndex].quantity + activeQuantity;
    if (targetQty > maxAvailable) {
      showToast(`أقصى كمية يمكنك إضافتها هي ${maxAvailable}`);
      return;
    }
    cart[existingIndex].quantity = targetQty;
  } else {
    cart.push({
      itemKey,
      product_id: prod.id,
      variant_id: variant ? variant.id : null,
      product_name: prod.name,
      color_name: colorName,
      size_name: sizeName,
      sku: sku || 'SKU-NONE',
      unit_price: Number(unitPrice),
      unit_cost: Number(unitCost),
      quantity: activeQuantity,
      maxAvailable,
      image_url: imageUrl
    });
  }

  persistCart();
  updateCartBadge();
  closeModal('productModal');
  openCart();
  showToast('تمت إضافة المنتج إلى السلة ✓');
}

function updateCartBadge() {
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  getElem('cartBadge').textContent = totalItems;
  getElem('cartCount').textContent = totalItems;
}

function openCart() {
  renderCartDrawer();
  getElem('cartDrawer').classList.add('active');
  getElem('cartOverlay').classList.add('active');
  document.body.classList.add('no-scroll');
}

function closeCart() {
  getElem('cartDrawer').classList.remove('active');
  getElem('cartOverlay').classList.remove('active');
  if (!document.querySelector('.modal.active')) document.body.classList.remove('no-scroll');
}

function renderCartDrawer() {
  const container = getElem('cartItems');
  const foot = getElem('cartFoot');

  if (!cart.length) {
    container.innerHTML = `
      <div class="cart-empty-state">
        <div style="font-size:3rem; margin-bottom:12px;">🛍️</div>
        <p>سلة التسوق فارغة حاليًا</p>
      </div>`;
    foot.style.display = 'none';
    return;
  }

  foot.style.display = 'block';
  container.innerHTML = cart.map((item, idx) => `
    <div class="cart-item">
      ${item.image_url 
        ? `<img class="cart-item-img" src="${item.image_url}" alt="${item.product_name}">`
        : `<div class="cart-item-img" style="display:flex;align-items:center;justify-content:center;font-size:1.6rem;">👕</div>`}
      <div class="cart-item-info">
        <div class="ci-title">${item.product_name}</div>
        <div class="ci-variant">${[item.color_name, item.size_name].filter(Boolean).join(' / ') || 'المقاس القياسي'}</div>
        <div class="ci-qty-row">
          <button class="ci-qty-btn" type="button" onclick="modifyCartQty(${idx}, -1)">−</button>
          <span style="font-weight:700; font-size:0.9rem;">${item.quantity}</span>
          <button class="ci-qty-btn" type="button" onclick="modifyCartQty(${idx}, 1)">+</button>
        </div>
        <span class="ci-remove" onclick="removeCartItem(${idx})">إزالة</span>
      </div>
      <div class="ci-price">${formatEGP(item.unit_price * item.quantity)}</div>
    </div>
  `).join('');

  calculateTotals();
}

function modifyCartQty(index, delta) {
  const item = cart[index];
  const newQty = item.quantity + delta;

  if (newQty <= 0) {
    cart.splice(index, 1);
  } else if (newQty > item.maxAvailable) {
    showToast(`المخزون المتاح هو ${item.maxAvailable} فقط`);
    return;
  } else {
    item.quantity = newQty;
  }

  persistCart();
  updateCartBadge();
  renderCartDrawer();
}

function removeCartItem(index) {
  cart.splice(index, 1);
  persistCart();
  updateCartBadge();
  renderCartDrawer();
  showToast('تم حذف المنتج من السلة');
}

function calculateTotals() {
  syncCartPrices();
  const subtotal = cart.reduce((acc, i) => acc + (i.unit_price * i.quantity), 0);
  const totalQuantity = cart.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
  let discountAmount = 0;
  let promotionCode = null;

  if (appliedCouponData) {
    const eligibleSub = cart.reduce((acc, i) => {
      const isEligible = !appliedCouponData.allowedProductIds || appliedCouponData.allowedProductIds.includes(i.product_id);
      return isEligible ? acc + (i.unit_price * i.quantity) : acc;
    }, 0);

    if (eligibleSub > 0) {
      if (appliedCouponData.discount_type === 'percentage') {
        discountAmount = eligibleSub * (appliedCouponData.discount_value / 100);
      } else {
        discountAmount = appliedCouponData.discount_value;
      }
      if (appliedCouponData.maximum_discount_amount) {
        discountAmount = Math.min(discountAmount, appliedCouponData.maximum_discount_amount);
      }
      discountAmount = Math.min(discountAmount, eligibleSub);
    }
  } else if (totalQuantity >= 2) {
    discountAmount = subtotal * (STORE_CONFIG.BUY_TWO_DISCOUNT_PERCENT / 100);
    promotionCode = 'BUY_2_GET_10';
  }

  const shippingCost = getShippingCost(selectedGovernorate, subtotal);
  const effectiveShipping = shippingCost !== null ? shippingCost : 0;
  const finalTotal = Math.max(0, subtotal - discountAmount) + effectiveShipping;

  // 1. تحديث ملخص السلة
  const sumSubtotalEl = getElem('sumSubtotal');
  if (sumSubtotalEl) sumSubtotalEl.textContent = formatEGP(subtotal);

  const sumShippingEl = getElem('sumShipping');
  if (sumShippingEl) {
    if (shippingCost === null) {
      sumShippingEl.textContent = tr('اختر المحافظة', 'Select governorate');
    } else {
      sumShippingEl.textContent = formatEGP(shippingCost);
    }
  }

  const sumTotalEl = getElem('sumTotal');
  if (sumTotalEl) {
    if (shippingCost === null && subtotal > 0) {
      sumTotalEl.textContent = formatEGP(Math.max(0, subtotal - discountAmount)) + ' + ' + tr('الشحن', 'Shipping');
    } else {
      sumTotalEl.textContent = formatEGP(finalTotal);
    }
  }

  const discountLine = getElem('discountLine');
  if (discountLine) {
    if (discountAmount > 0) {
      discountLine.style.display = 'flex';
      const discountLabel = getElem('discountLabel');
      if (discountLabel) {
        discountLabel.textContent = promotionCode
          ? tr('عرض قطعتين (خصم 10٪)', 'Buy 2 offer (10% off)')
          : tr('الخصم', 'Discount');
      }
      getElem('sumDiscount').textContent = `- ${formatEGP(discountAmount)}`;
    } else {
      discountLine.style.display = 'none';
    }
  }

  // 2. تحديث ملخص نافذة الدفع (Checkout Modal)
  const chkSubtotal = getElem('checkoutSubtotal');
  if (chkSubtotal) chkSubtotal.textContent = formatEGP(subtotal);

  const chkDiscountLine = getElem('checkoutDiscountLine');
  const chkDiscount = getElem('checkoutDiscount');
  if (chkDiscountLine && chkDiscount) {
    if (discountAmount > 0) {
      chkDiscountLine.style.display = 'flex';
      chkDiscount.textContent = `- ${formatEGP(discountAmount)}`;
    } else {
      chkDiscountLine.style.display = 'none';
    }
  }

  const chkShipping = getElem('checkoutShipping');
  if (chkShipping) {
    if (shippingCost === null) {
      chkShipping.textContent = tr('اختر المحافظة', 'Select governorate');
    } else {
      chkShipping.textContent = formatEGP(shippingCost);
    }
  }

  const chkTotal = getElem('checkoutTotal');
  if (chkTotal) {
    if (shippingCost === null && subtotal > 0) {
      chkTotal.textContent = formatEGP(Math.max(0, subtotal - discountAmount)) + ' + ' + tr('الشحن', 'Shipping');
    } else {
      chkTotal.textContent = formatEGP(finalTotal);
    }
  }

  window.CURRENT_ORDER_TOTALS = {
    subtotal,
    discountAmount,
    promotionCode,
    shipping: effectiveShipping,
    shippingCost,
    finalTotal
  };
}

// 9. تطبيق كود الخصم (Coupons)
async function applyCoupon() {
  const input = getElem('couponInput');
  const code = (input.value || '').trim().toUpperCase();
  const msgEl = getElem('couponMsg');

  appliedCouponData = null;
  calculateTotals();

  if (!code) {
    msgEl.textContent = '';
    return;
  }

  try {
    const { data: coupon, error } = await supabaseClient
      .from('discounts')
      .select('*')
      .eq('code', code)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !coupon) {
      msgEl.className = 'coupon-msg error';
      msgEl.textContent = '❌ كود الخصم غير صحيح أو غير مفعل';
      return;
    }

    const now = new Date();
    if (coupon.starts_at && new Date(coupon.starts_at) > now) {
      msgEl.className = 'coupon-msg error';
      msgEl.textContent = '❌ هذا الكوبون لم يبدأ تفعيله بعد';
      return;
    }
    if (coupon.expires_at && new Date(coupon.expires_at) < now) {
      msgEl.className = 'coupon-msg error';
      msgEl.textContent = '❌ انتهت صلاحية هذا الكوبون';
      return;
    }
    if (coupon.usage_limit && (coupon.usage_count || 0) >= coupon.usage_limit) {
      msgEl.className = 'coupon-msg error';
      msgEl.textContent = '❌ تم استهلاك الحد الأقصى لاستخدام الكوبون';
      return;
    }

    const currentSubtotal = cart.reduce((acc, i) => acc + (i.unit_price * i.quantity), 0);
    if (coupon.minimum_order_amount && currentSubtotal < coupon.minimum_order_amount) {
      msgEl.className = 'coupon-msg error';
      msgEl.textContent = `❌ الحد الأدنى لتطبيق الخصم هو ${formatEGP(coupon.minimum_order_amount)}`;
      return;
    }

    // التحقق إذا كان الكود مخصصًا لمنتجات معينة
    const { data: allowedProducts } = await supabaseClient
      .from('discount_products')
      .select('product_id')
      .eq('discount_id', coupon.id);

    let allowedIds = null;
    if (allowedProducts && allowedProducts.length > 0) {
      allowedIds = allowedProducts.map(p => p.product_id);
      const hasEligibleItem = cart.some(i => allowedIds.includes(i.product_id));
      if (!hasEligibleItem) {
        msgEl.className = 'coupon-msg error';
        msgEl.textContent = '❌ هذا الكود لا ينطبق على المنتجات الموجودة في السلة';
        return;
      }
    }

    appliedCouponData = {
      ...coupon,
      allowedProductIds: allowedIds
    };

    msgEl.className = 'coupon-msg success';
    msgEl.textContent = `✓ تم تطبيق الخصم: ${coupon.name}`;
    calculateTotals();
    showToast('تم تفعيل كود الخصم بنجاح');
  } catch (err) {
    console.error('خطأ أثناء التحقق من الكوبون:', err);
    msgEl.className = 'coupon-msg error';
    msgEl.textContent = 'حدث خطأ أثناء فحص الكود';
  }
}

// 10. إتمام الطلب (Checkout & Order Submission)
function openCheckout() {
  if (!cart.length) {
    showToast(tr('سلة التسوق فارغة', 'Cart is empty'));
    return;
  }
  const modalSelect = getElem('governorateSelect');
  if (modalSelect && selectedGovernorate) {
    modalSelect.value = selectedGovernorate;
  }
  calculateTotals();
  closeCart();
  openModal('checkoutModal');
}

async function submitOrder(e) {
  e.preventDefault();
  const btn = getElem('submitOrderBtn');
  btn.disabled = true;
  const submitLabel = btn.querySelector('.button-label');
  if (submitLabel) submitLabel.textContent = tr('جاري تسجيل الطلب...', 'Saving order...');
  else btn.textContent = tr('جاري تسجيل الطلب...', 'Saving order...');

  const form = new FormData(e.target);
  const governorate = (form.get('governorate') || selectedGovernorate || '').trim();

  if (!governorate) {
    showToast(tr('يرجى اختيار المحافظة لحساب تكلفة الشحن', 'Please select your governorate to calculate shipping'));
    btn.disabled = false;
    if (submitLabel) submitLabel.textContent = tr('تأكيد الطلب الآن', 'Confirm order');
    else btn.textContent = tr('تأكيد الطلب الآن', 'Confirm order');
    const govSelect = getElem('governorateSelect');
    if (govSelect) govSelect.focus();
    return;
  }

  selectedGovernorate = governorate;
  calculateTotals();

  const subtotal = cart.reduce((a, i) => a + (i.unit_price * i.quantity), 0);
  const discountAmount = window.CURRENT_ORDER_TOTALS ? window.CURRENT_ORDER_TOTALS.discountAmount : 0;
  const shippingCost = getShippingCost(governorate, subtotal) || 0;
  const totals = {
    subtotal,
    discountAmount,
    promotionCode: window.CURRENT_ORDER_TOTALS ? window.CURRENT_ORDER_TOTALS.promotionCode : null,
    shipping: shippingCost,
    finalTotal: Math.max(0, subtotal - discountAmount) + shippingCost
  };

  const totalCost = cart.reduce((acc, i) => acc + (i.unit_cost * i.quantity), 0);
  const totalProfit = Math.max(0, (totals.finalTotal - totals.shipping) - totalCost);
  const orderNumber = 'ORD-' + Date.now().toString().slice(-7);

  const orderPayload = {
    customer_name: form.get('customer_name'),
    customer_phone: form.get('customer_phone'),
    customer_email: form.get('customer_email') || null,
    governorate: form.get('governorate'),
    city: form.get('city') || form.get('governorate') || '',
    area: form.get('area') || '',
    address_line: form.get('address_line') || form.get('address_line1') || '',
    building_number: form.get('building_number') || null,
    apartment_number: form.get('apartment_number') || null,
    floor_number: form.get('floor_number') || null,
    address_notes: form.get('address_notes') || null,
    subtotal: totals.subtotal,
    discount_amount: totals.discountAmount,
    shipping_cost: totals.shipping,
    total_amount: totals.finalTotal,
    total_cost: totalCost,
    total_profit: totalProfit,
    discount_id: appliedCouponData ? appliedCouponData.id : null,
    discount_code: appliedCouponData ? appliedCouponData.code : totals.promotionCode,
    payment_method: 'cash_on_delivery',
    payment_status: 'pending',
    status: 'pending',
    customer_notes: null
  };

  try {
    // 1. إدراج الطلب في جدول orders
    const { data: newOrder, error: oError } = await supabaseClient
      .from('orders')
      .insert(orderPayload)
      .select()
      .single();

    if (oError) throw oError;

    // 2. إدراج عناصر الطلب في جدول order_items (Snapshot للأسعار)
    const itemsPayload = cart.map(item => ({
      order_id: newOrder.id,
      product_id: item.product_id,
      variant_id: item.variant_id,
      product_name: item.product_name,
      color_name: item.color_name,
      size_name: item.size_name,
      sku: item.sku,
      quantity: item.quantity,
      unit_price: item.unit_price,
      unit_cost: item.unit_cost,
      total_price: item.unit_price * item.quantity,
      total_cost: item.unit_cost * item.quantity,
      profit: (item.unit_price - item.unit_cost) * item.quantity
    }));

    const { error: itemsError } = await supabaseClient
      .from('order_items')
      .insert(itemsPayload);

    if (itemsError) console.error('خطأ في إدراج عناصر الطلب:', itemsError);

    // 3. خصم المخزون
    for (const item of cart) {
      if (item.variant_id) {
        const variantsList = Object.values(productVariantsMap).flat();
        const vObj = variantsList.find(x => x.id === item.variant_id);
        if (vObj) {
          const newQty = Math.max(0, (vObj.stock_quantity || 0) - item.quantity);
          await supabaseClient
            .from('product_variants')
            .update({ stock_quantity: newQty })
            .eq('id', item.variant_id);
        }
      }
      const pObj = productsList.find(x => x.id === item.product_id);
      if (pObj) {
        const newProdQty = Math.max(0, (pObj.stock_quantity || 0) - item.quantity);
        await supabaseClient
          .from('products')
          .update({ stock_quantity: newProdQty })
          .eq('id', item.product_id);
      }
    }

    // 4. تحديث عداد استخدام الكوبون
    if (appliedCouponData) {
      await supabaseClient
        .from('discounts')
        .update({ usage_count: (appliedCouponData.usage_count || 0) + 1 })
        .eq('id', appliedCouponData.id);
    }

    // 5. إرسال الطلب على إيميل الأدمن
    await sendOrderEmailToAdmin({ ...orderPayload, ...newOrder }, cart.map(i => ({ ...i })));

    // 6. تصفير السلة وإنهاء الطلب
    cart = [];
    persistCart();
    appliedCouponData = null;
    updateCartBadge();
    e.target.reset();

    closeModal('checkoutModal');
    const displayOrderNo = newOrder.order_number ? `#${newOrder.order_number}` : (newOrder.id ? `#${newOrder.id.slice(0, 8)}` : '');
    getElem('successOrderNo').textContent = displayOrderNo;
    openModal('successModal');

    // إعادة تحميل المنتجات لتحديث المخزون
    fetchProducts();
  } catch (err) {
    console.error('فشل في إرسال الطلب:', err);
    showToast('حدث خطأ أثناء حفظ الطلب، يرجى المحاولة مرة أخرى.');
  } finally {
    btn.disabled = false;
    if (submitLabel) submitLabel.textContent = tr('تأكيد الطلب الآن', 'Confirm order');
    else btn.textContent = tr('تأكيد الطلب الآن', 'Confirm order');
  }
}

function finishOrder() {
  closeModal('successModal');
  goHome();
}

function handleNewsletterSubscribe(event) {
  event.preventDefault();
  const message = getElem('newsletterMessage');
  if (!message) return;
  message.hidden = false;
}

function applyLanguage(lang) {
  MCL_LANG = lang === 'en' ? 'en' : 'ar';
  localStorage.setItem('mcl_language', MCL_LANG);
  document.documentElement.lang = MCL_LANG;
  document.documentElement.dir = MCL_LANG === 'ar' ? 'rtl' : 'ltr';
  document.body.classList.toggle('is-english', MCL_LANG === 'en');

  document.querySelectorAll('[data-ar], [data-en]').forEach(el => {
    const value = el.getAttribute(`data-${MCL_LANG}`);
    if (value !== null) {
      const label = el.querySelector('.button-label');
      if (label) {
        label.textContent = value;
      } else if (el.children.length && el.firstChild && el.firstChild.nodeType === Node.TEXT_NODE) {
        el.firstChild.nodeValue = `${value} `;
      } else {
        el.textContent = value;
      }
    }
  });

  document.querySelectorAll('[data-ar-html], [data-en-html]').forEach(el => {
    const value = el.getAttribute(`data-${MCL_LANG}-html`);
    if (value !== null) el.innerHTML = value;
  });

  document.querySelectorAll('[data-placeholder-ar], [data-placeholder-en]').forEach(el => {
    const value = el.getAttribute(`data-placeholder-${MCL_LANG}`);
    if (value !== null) el.placeholder = value;
  });

  document.querySelectorAll('[data-aria-ar], [data-aria-en]').forEach(el => {
    const value = el.getAttribute(`data-aria-${MCL_LANG}`);
    if (value !== null) el.setAttribute('aria-label', value);
  });

  const toggle = getElem('languageToggle');
  if (toggle) {
    toggle.textContent = MCL_LANG === 'ar' ? 'EN' : 'عربي';
    toggle.setAttribute('aria-label', MCL_LANG === 'ar' ? 'Switch to English' : 'التبديل إلى العربية');
  }

  calculateTotals();
  if (getElem('productsGrid')) renderGrid();
}

function toggleLanguage() {
  applyLanguage(MCL_LANG === 'ar' ? 'en' : 'ar');
}

// تشغيل المتجر عند جاهزية الصفحة
document.addEventListener('DOMContentLoaded', initWinterCountdown);
document.addEventListener('DOMContentLoaded', initStore);
document.addEventListener('DOMContentLoaded', () => applyLanguage(MCL_LANG));
