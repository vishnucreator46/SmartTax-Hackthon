// POS System Logic - ES Module
import { db, auth } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.2/firebase-auth.js';
import { collection, getDocs, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js';

// Global cart state
window.cart = [];
let products = [];

// Initialize POS on page load
document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = 'index.html';
    }
  });

  // Load products from Firestore
  await loadProducts();
});

// Load products from Firestore collection "products"
async function loadProducts() {
  try {
    const querySnapshot = await getDocs(collection(db, 'products'));
    products = [];
    const productsSection = document.getElementById('productsSection');
    productsSection.innerHTML = '';

    if (querySnapshot.empty) {
      productsSection.innerHTML = `
        <div class="card" style="grid-column: 1 / -1;">
          <p style="text-align: center; color: #b0b0b0;">No products available.</p>
          <button class="btn-primary" onclick="window.seedProducts()" style="display: block; margin: 15px auto;">Add Sample Products</button>
        </div>`;
      return;
    }

    querySnapshot.forEach((doc) => {
      const product = { id: doc.id, ...doc.data() };
      products.push(product);

      // Create product card
      const card = document.createElement('div');
      card.className = 'product-card';
      card.innerHTML = `
        <div class="product-name">${product.name}</div>
        <div class="product-price">₹${parseFloat(product.cost).toFixed(2)} <span style="font-size:0.8em; color:#888">(${product.taxRate}%)</span></div>
        <button class="btn-primary btn-small" onclick="window.addToCart('${product.id}')">Add to Cart</button>
      `;
      productsSection.appendChild(card);
    });

    console.log('Products loaded:', products.length);
  } catch (error) {
    console.error('Error loading products:', error);
    document.getElementById('productsSection').innerHTML = `<div class="card" style="grid-column: 1 / -1;"><p style="text-align: center; color: #dc3545;">Error loading products: ${error.message}</p></div>`;
  }
}

// Add product to cart
window.addToCart = (productId) => {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const existingItem = window.cart.find(item => item.id === productId);
  
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    window.cart.push({
      id: productId,
      name: product.name,
      cost: parseFloat(product.cost),
      taxRate: parseFloat(product.taxRate),
      quantity: 1
    });
  }

  console.log('Item added to cart:', product.name);
  updateCartUI();
};

// Remove item from cart
window.removeFromCart = (productId) => {
  window.cart = window.cart.filter(item => item.id !== productId);
  console.log('Item removed from cart');
  updateCartUI();
};

// Update cart UI
function updateCartUI() {
  const cartItemsEl = document.getElementById('cartItems');
  
  if (window.cart.length === 0) {
    cartItemsEl.innerHTML = '<p style="text-align: center; color: #b0b0b0; padding: 20px 0;">Cart is empty</p>';
  } else {
    cartItemsEl.innerHTML = window.cart.map(item => `
      <div class="cart-item">
        <div>
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-qty">Qty: ${item.quantity}</div>
        </div>
        <div style="text-align: right;">
          <div class="cart-item-price">₹${(item.cost * item.quantity).toFixed(2)}</div>
          <button class="cart-item-remove" onclick="window.removeFromCart('${item.id}')">Remove</button>
        </div>
      </div>
    `).join('');
  }

  updateTotals();
}

// Update totals with GST calculation
function updateTotals() {
  // Calculate subtotal
  const subtotal = window.cart.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
  
  // Calculate taxes based on individual product taxRate
  let tax5Total = 0;
  let tax18Total = 0;
  let subtotal5 = 0;
  let subtotal18 = 0;

  window.cart.forEach(item => {
    const itemTotal = item.cost * item.quantity;
    const taxAmount = (itemTotal * item.taxRate) / 100;
    
    if (item.taxRate === 5) {
      tax5Total += taxAmount;
      subtotal5 += itemTotal;
    } else if (item.taxRate === 18) {
      tax18Total += taxAmount;
      subtotal18 += itemTotal;
    }
  });

  const totalTax = tax5Total + tax18Total;
  const grandTotal = subtotal + totalTax;

  // Update UI
  document.getElementById('subtotal').textContent = `₹${subtotal.toFixed(2)}`;
  
  // Update GST Info section to show breakdown
  const gstInfoEl = document.querySelector('.gst-info');
  gstInfoEl.innerHTML = `
    <div class="summary-row"><span class="summary-label">Tax (5%):</span><span class="summary-value">₹${tax5Total.toFixed(2)}</span></div>
    <div class="summary-row"><span class="summary-label">Tax (18%):</span><span class="summary-value">₹${tax18Total.toFixed(2)}</span></div>
  `;

  document.getElementById('gstAmount').textContent = `₹${totalTax.toFixed(2)}`;
  document.getElementById('grandTotal').textContent = `₹${grandTotal.toFixed(2)}`;

  // Store for checkout
  window.currentSaleData = {
    subtotal,
    subtotal5,
    subtotal18,
    tax5Total,
    tax18Total,
    totalTax,
    grandTotal
  };
}

// Complete sale and save to Firestore
window.completeSale = async () => {
  if (window.cart.length === 0) {
    alert('Cart is empty. Add items before completing sale.');
    return;
  }

  const completeSaleBtn = document.getElementById('completeSaleBtn');
  completeSaleBtn.disabled = true;
  completeSaleBtn.textContent = 'Processing...';

  try {
    // Prepare sale data
    const saleData = {
      items: window.cart.map(item => ({
        id: item.id,
        name: item.name,
        cost: item.cost,
        taxRate: item.taxRate,
        quantity: item.quantity
      })),
      subtotal: window.currentSaleData.subtotal,
      subtotal5: window.currentSaleData.subtotal5,
      subtotal18: window.currentSaleData.subtotal18,
      tax5Total: window.currentSaleData.tax5Total,
      tax18Total: window.currentSaleData.tax18Total,
      gstAmount: window.currentSaleData.totalTax,
      total: window.currentSaleData.grandTotal,
      cashier: auth.currentUser?.email || 'Unknown',
      timestamp: serverTimestamp()
    };

    // Save to Firestore collection "sales"
    const docRef = await addDoc(collection(db, 'sales'), saleData);
    console.log('Sale saved with ID:', docRef.id);

    // Reset cart
    window.cart = [];
    updateCartUI();

    // Show success message
    alert(`Sale completed successfully!\nTotal: ₹${window.currentSaleData.grandTotal.toFixed(2)}`);

    completeSaleBtn.disabled = false;
    completeSaleBtn.textContent = 'Complete Sale';
  } catch (error) {
    console.error('Error completing sale:', error);
    alert('Error completing sale. Check console.');
    completeSaleBtn.disabled = false;
    completeSaleBtn.textContent = 'Complete Sale';
  }
};

// Initialize empty totals
updateTotals();

// Function to add sample products
window.seedProducts = async () => {
  const sampleProducts = [
    { name: "Wireless Mouse", cost: 450, taxRate: 5 },
    { name: "Mechanical Keyboard", cost: 2500, taxRate: 18 },
    { name: "24-inch Monitor", cost: 12000, taxRate: 18 },
    { name: "USB-C Hub", cost: 1500, taxRate: 5 },
    { name: "Laptop Stand", cost: 850, taxRate: 5 }
  ];

  try {
    for (const product of sampleProducts) {
      await addDoc(collection(db, 'products'), product);
    }
    alert('Sample products added successfully!');
    loadProducts();
  } catch (error) {
    console.error('Error seeding products:', error);
    alert('Error adding products: ' + error.message);
  }
};
