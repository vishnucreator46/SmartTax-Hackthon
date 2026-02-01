// POS System Logic - ES Module
import { db, auth } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.2/firebase-auth.js';
import { collection, getDocs, addDoc, serverTimestamp, updateDoc, doc, increment, writeBatch, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js';

// Global cart state
window.cart = [];
let products = [];

// Initialize POS on page load
document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = 'index.html';
    } else {
      // Personalize Header
      try {
        const docSnap = await getDoc(doc(db, 'admins', user.uid));
        if (docSnap.exists()) {
          window.currentAdmin = docSnap.data();
          const headerTitle = document.querySelector('.header-title');
          if (headerTitle) headerTitle.textContent = `Welcome, ${docSnap.data().name}`;
        }
      } catch (e) { console.error('Error fetching profile', e); }
    }
  });

  // Phone input restriction
  const phoneInput = document.getElementById('customerPhone');
  if (phoneInput) {
    phoneInput.addEventListener('input', (e) => {
      const rawValue = e.target.value.replace(/\D/g, '');
      if (rawValue.length > 10) {
        e.target.classList.add('input-error');
        setTimeout(() => e.target.classList.remove('input-error'), 300);
      }
      e.target.value = rawValue.slice(0, 10);
    });
  }

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
      const imgUrl = product.img || product.imageUrl || '';
      const imageHtml = imgUrl 
        ? `<img src="${imgUrl}" alt="${product.name}" style="width: 100%; height: 120px; object-fit: contain; border-radius: 4px; margin-bottom: 10px;">`
        : `<div style="width: 100%; height: 120px; display: flex; align-items: center; justify-content: center; background-color: #3d3d3d; border-radius: 4px; margin-bottom: 10px; color: #b0b0b0;">No Image</div>`;

      const card = document.createElement('div');
      card.className = 'product-card';
      card.id = `product-card-${product.id}`;
      card.innerHTML = `
        ${imageHtml}
        <div class="product-name">${product.name}</div>
        <div class="product-price">₹${parseFloat(product.cost || 0).toFixed(2)} <span style="font-size:0.8em; color:#888">(${product.taxRate}%)</span></div>
        <div style="font-size: 0.8em; color: #b0b0b0; margin-bottom: 8px;">Stock: ${product.qnty !== undefined ? product.qnty : 'N/A'}</div>
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

  // FLYING IMAGE ANIMATION
  const productCard = document.getElementById(`product-card-${productId}`);
  const productImg = productCard ? productCard.querySelector('img') : null;
  const cartSidebar = document.querySelector('.cart-sidebar');

  if (productImg && cartSidebar) {
    const imgClone = productImg.cloneNode();
    imgClone.className = 'flying-img';
    
    const rect = productImg.getBoundingClientRect();
    const cartRect = cartSidebar.getBoundingClientRect();
    
    // Start position
    imgClone.style.top = `${rect.top}px`;
    imgClone.style.left = `${rect.left}px`;
    imgClone.style.width = `${rect.width}px`;
    imgClone.style.height = `${rect.height}px`;
    
    document.body.appendChild(imgClone);
    
    // Force reflow
    void imgClone.offsetWidth;
    
    // End position (Cart icon area)
    imgClone.style.top = `${cartRect.top + 20}px`;
    imgClone.style.left = `${cartRect.left + 20}px`;
    imgClone.style.width = '30px';
    imgClone.style.height = '30px';
    imgClone.style.opacity = '0';
    
    setTimeout(() => {
      imgClone.remove();
    }, 800);
  }

  const existingItem = window.cart.find(item => item.id === productId);
  
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    window.cart.push({
      id: productId,
      name: product.name,
      cost: parseFloat(product.cost || 0),
      taxRate: parseFloat(product.taxRate || 0),
      quantity: 1
    });
  }

  console.log('Item added to cart:', product.name);
  
  // Trigger Pulse Animation
  const card = document.getElementById(`product-card-${productId}`);
  if (card) {
    card.classList.add('item-added');
    setTimeout(() => card.classList.remove('item-added'), 300);
  }
  
  updateCartUI();
};

// Remove item from cart
window.removeFromCart = (productId) => {
  const itemEl = document.getElementById(`cart-item-${productId}`);
  
  if (itemEl) {
    itemEl.classList.add('cart-item-fade-out');
    setTimeout(() => {
      window.cart = window.cart.filter(item => item.id !== productId);
      updateCartUI();
    }, 400); // Wait for animation
  } else {
    window.cart = window.cart.filter(item => item.id !== productId);
    updateCartUI();
  }
};

// Update cart UI
function updateCartUI() {
  const cartItemsEl = document.getElementById('cartItems');
  
  if (window.cart.length === 0) {
    cartItemsEl.innerHTML = '<p style="text-align: center; color: #b0b0b0; padding: 20px 0;">Cart is empty</p>';
  } else {
    cartItemsEl.innerHTML = window.cart.map(item => `
      <div class="cart-item" id="cart-item-${item.id}">
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
  
  // Dynamic Tax Rate Logic: > 2500 is 18%, else 5%
  const appliedTaxRate = subtotal > 2500 ? 18 : 5;
  
  // Calculate taxes
  const totalTax = (subtotal * appliedTaxRate) / 100;
  const grandTotal = subtotal + totalTax;

  // Prepare breakdown for Admin Dashboard compatibility
  let subtotal5 = 0;
  let subtotal18 = 0;
  let tax5Total = 0;
  let tax18Total = 0;

  if (appliedTaxRate === 5) {
    subtotal5 = subtotal;
    tax5Total = totalTax;
  } else {
    subtotal18 = subtotal;
    tax18Total = totalTax;
  }

  // Update UI
  document.getElementById('subtotal').textContent = `₹${subtotal.toFixed(2)}`;
  
  // Update GST Info section to show applied rate
  const gstInfoEl = document.querySelector('.gst-info');
  gstInfoEl.innerHTML = `
    <div class="summary-row"><span class="summary-label">Applied Tax Rate:</span><span class="gst-rate">${appliedTaxRate}%</span></div>
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
    grandTotal,
    appliedTaxRate
  };
}

// Complete sale and save to Firestore
window.completeSale = async () => {
  if (window.cart.length === 0) {
    alert('Cart is empty. Add items before completing sale.');
    return;
  }

  const customerName = document.getElementById('customerName').value.trim();
  const customerPhone = document.getElementById('customerPhone').value.trim();

  if (!customerName || !customerPhone) {
    alert('Please enter Customer Name and Phone Number.');
    return;
  }

  if (customerPhone.length !== 10) {
    alert('Mobile number must be exactly 10 digits');
    return;
  }

  const completeSaleBtn = document.getElementById('completeSaleBtn');
  completeSaleBtn.disabled = true;
  completeSaleBtn.textContent = 'Processing...';

  try {
    // Capture final total before reset
    const finalTotal = window.currentSaleData.grandTotal;

    // Prepare sale data
    const saleData = {
      customerName,
      customerPhone,
      items: window.cart.map(item => ({
        id: item.id,
        name: item.name,
        cost: parseFloat(item.cost || 0),
        taxRate: window.currentSaleData.appliedTaxRate,
        quantity: item.quantity
      })),
      subtotal: window.currentSaleData.subtotal,
      subtotal5: window.currentSaleData.subtotal5,
      subtotal18: window.currentSaleData.subtotal18,
      tax5Total: window.currentSaleData.tax5Total,
      tax18Total: window.currentSaleData.tax18Total,
      gstAmount: window.currentSaleData.totalTax,
      total: finalTotal,
      cashier: auth.currentUser?.email || 'Unknown',
      timestamp: serverTimestamp()
    };

    // Save to Firestore collection "sales"
    const docRef = await addDoc(collection(db, 'sales'), saleData);
    console.log('Sale saved with ID:', docRef.id);

    // Update Inventory: Reduce quantity for each sold item
    await Promise.all(window.cart.map(item => 
      updateDoc(doc(db, 'products', item.id), {
        qnty: increment(-item.quantity)
      })
    ));
    loadProducts(); // Refresh UI to show updated stock

    // Generate Challan PDF
    await window.generateChallan(saleData, 'CUSTOMER');
    await window.generateChallan(saleData, 'OFFICE');

    // Show success message (SweetAlert2)
    if (window.Swal) {
      await window.Swal.fire({
        title: 'Sale Completed!',
        text: `Total: ₹${finalTotal.toFixed(2)}`,
        icon: 'success',
        confirmButtonText: 'OK',
        confirmButtonColor: '#10b981',
        background: '#1e1e1e',
        color: '#f3f4f6'
      });
    } else {
      alert(`Sale completed successfully!\nTotal: ₹${finalTotal.toFixed(2)}`);
    }

    // Reset cart
    window.cart = [];
    document.getElementById('customerName').value = '';
    document.getElementById('customerPhone').value = '';
    updateCartUI();

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
    // TIP: Replace the strings in 'imageUrl' with your own image links (Right Click Image -> Copy Image Address)
    { name: "acer Aspire 3", cost: 27000, taxRate: 18, imageUrl: "https://tse3.mm.bing.net/th/id/OIP.o-OYYRQKQNZWwM1f9KPLYgHaF5?pid=Api&P=0&h=180" },
    { name: "Mechanical Keyboard", cost: 2500, taxRate: 18, imageUrl: "https://placehold.co/300x200?text=Keyboard" },
    { name: "24-inch Monitor", cost: 12000, taxRate: 18, imageUrl: "https://placehold.co/300x200?text=Monitor" },
    { name: "USB-C Hub", cost: 1500, taxRate: 5, imageUrl: "https://placehold.co/300x200?text=USB+Hub" },
    { name: "Laptop Stand", cost: 850, taxRate: 5, imageUrl: "https://placehold.co/300x200?text=Stand" }
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

// Generate PDF Challan
window.generateChallan = async (saleData, copyType = 'CUSTOMER') => {
  if (!window.jspdf) {
    console.error('jsPDF library not loaded');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Helper to fetch image and convert to Base64
  const getBase64ImageFromUrl = (url) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        try {
          resolve(canvas.toDataURL('image/jpeg'));
        } catch (e) {
          resolve(null); // Return null if CORS blocks export
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  // Header
  doc.setFontSize(18);
  doc.text('SmartTax POS', 14, 22);

  // Copy Label
  doc.setFontSize(14);
  doc.setTextColor(100);
  doc.text(copyType === 'OFFICE' ? 'OFFICE COPY' : 'CUSTOMER COPY', 196, 22, { align: 'right' });
  doc.setTextColor(0);
  
  doc.setFontSize(10);
  doc.text(`Date: ${new Date().toLocaleString()}`, 14, 32);
  doc.text(`Customer: ${saleData.customerName}`, 14, 38);
  doc.text(`Phone: ${saleData.customerPhone}`, 14, 44);

  let startY = 50;
  if (copyType === 'OFFICE') {
    const adminName = window.currentAdmin?.name || 'Unknown';
    const adminId = window.currentAdmin?.empId || 'N/A';
    doc.text(`Admin: ${adminName} | ID: ${adminId}`, 14, 50);
    startY = 56;
  }

  // Table Data
  const tableColumn = ["", "Item", "Qty", "Cost", "Tax Rate", "Total"];
  const tableRows = [];
  const rowImages = [];

  for (const item of saleData.items) {
    const product = products.find(p => p.id === item.id);
    const imgUrl = product ? (product.img || product.imageUrl) : null;
    
    if (imgUrl) {
      const b64 = await getBase64ImageFromUrl(imgUrl);
      rowImages.push(b64);
    } else {
      rowImages.push(null);
    }

    tableRows.push([
      "", // Placeholder for image column
      item.name,
      item.quantity,
      item.cost.toFixed(2),
      item.taxRate + '%',
      (item.cost * item.quantity).toFixed(2)
    ]);
  }

  // Generate Table
  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: startY,
    bodyStyles: { minCellHeight: 15, valign: 'middle' },
    columnStyles: { 0: { cellWidth: 15 } },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const imgData = rowImages[data.row.index];
        if (imgData) {
          doc.addImage(imgData, 'JPEG', data.cell.x + 2, data.cell.y + 2, 10, 10);
        } else {
          // Gray placeholder
          doc.setFillColor(220, 220, 220);
          doc.rect(data.cell.x + 2, data.cell.y + 2, 10, 10, 'F');
        }
      }
    }
  });

  const finalY = doc.lastAutoTable.finalY + 10;

  // Totals
  doc.text(`Total 5% GST Amount: ${saleData.tax5Total.toFixed(2)}`, 14, finalY);
  doc.text(`Total 18% GST Amount: ${saleData.tax18Total.toFixed(2)}`, 14, finalY + 6);
  doc.setFontSize(12);
  doc.text(`Grand Total: ${saleData.total.toFixed(2)}`, 14, finalY + 14);

  // Save file
  const filename = copyType === 'OFFICE' ? `Admin_Copy_${Date.now()}.pdf` : `Customer_Invoice_${Date.now()}.pdf`;
  doc.save(filename);
};

// STOCK MANAGER LOGIC

// Open Stock Manager Modal
window.showStockManager = async () => {
  const modal = document.getElementById('stockModal');
  const list = document.getElementById('stockList');
  
  if (!modal || !list) return;
  
  modal.style.display = 'flex';
  list.innerHTML = '<p style="text-align:center; color:#b0b0b0;">Loading products...</p>';

  // Ensure we have latest data
  await loadProducts();

  list.innerHTML = products.map(p => `
    <div class="stock-item">
      <div style="flex: 1;">
        <div style="font-weight:bold;">${p.name}</div>
        <div style="font-size:12px; color:#888;">Current: ${p.qnty !== undefined ? p.qnty : 0}</div>
      </div>
      <input type="number" id="stock-input-${p.id}" value="${p.qnty !== undefined ? p.qnty : 0}" class="stock-input" min="0">
    </div>
  `).join('');
};

// Close Stock Manager Modal
window.closeStockManager = () => {
  const modal = document.getElementById('stockModal');
  if (modal) modal.style.display = 'none';
};

// Update All Stock
window.updateAllStock = async () => {
  const batch = writeBatch(db);
  let updatesCount = 0;

  products.forEach(p => {
    const input = document.getElementById(`stock-input-${p.id}`);
    if (input) {
      const newVal = parseInt(input.value);
      // Only update if value is valid and changed
      if (!isNaN(newVal) && newVal !== (p.qnty || 0)) {
        const ref = doc(db, 'products', p.id);
        batch.update(ref, { qnty: newVal });
        updatesCount++;
      }
    }
  });

  if (updatesCount > 0) {
    await batch.commit();
    if (window.Swal) Swal.fire('Success', `Updated stock for ${updatesCount} products`, 'success');
    else alert(`Updated stock for ${updatesCount} products`);
    
    window.closeStockManager();
    loadProducts(); // Refresh main UI
  } else {
    if (window.Swal) Swal.fire('Info', 'No changes detected', 'info');
    else alert('No changes detected');
  }
};
