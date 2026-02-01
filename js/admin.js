// Admin Dashboard Logic - ES Module
import { db, auth } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.2/firebase-auth.js';
import { collection, getDocs, query, where, Timestamp, deleteDoc, doc, getDoc, addDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js';

// Store all sales data for reporting
let allSales = [];

// Initialize admin page on load
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
          const headerTitle = document.querySelector('.header-title');
          if (headerTitle) headerTitle.textContent = `Welcome, ${docSnap.data().name}`;
        }
      } catch (e) { console.error('Error fetching profile', e); }
    }
  });

  // Add Stock Handler
  const addStockBtn = document.getElementById('addStockBtn');
  const submitStockBtn = document.getElementById('submitNewStockBtn');
  
  if (addStockBtn) {
    addStockBtn.addEventListener('click', () => {
      const modal = document.getElementById('addStockModal');
      if (modal) modal.style.display = 'flex';
    });
  }

  if (submitStockBtn) {
    submitStockBtn.addEventListener('click', async () => {
      const id = document.getElementById('newStockId').value.trim();
      const name = document.getElementById('newStockName').value;
      const cost = parseFloat(document.getElementById('newStockCost').value);
      const qnty = parseInt(document.getElementById('newStockQnty').value);
      const img = document.getElementById('newStockImg').value;
      const taxRate = parseInt(document.getElementById('newStockTax').value);

      if (!name || isNaN(cost) || isNaN(qnty) || isNaN(taxRate)) {
        alert('Please fill all required fields (Name, Cost, Quantity, Tax Rate).');
        return;
      }

      try {
        const productData = {
          name,
          cost,
          qnty,
          img: img || '',
          taxRate
        };

        if (id) {
          await setDoc(doc(db, 'products', id), productData);
          alert('Product added successfully with ID: ' + id);
        } else {
          const docRef = await addDoc(collection(db, 'products'), productData);
          alert('Product added successfully with ID: ' + docRef.id);
        }

        document.getElementById('addStockModal').style.display = 'none';
        
        // Clear form
        document.getElementById('newStockId').value = '';
        document.getElementById('newStockName').value = '';
        document.getElementById('newStockCost').value = '';
        document.getElementById('newStockQnty').value = '';
        document.getElementById('newStockImg').value = '';
        document.getElementById('newStockTax').value = '';
      } catch (error) {
        console.error('Error adding product:', error);
        alert('Error adding product: ' + error.message);
      }
    });
  }

  // Download Report Handler
  const downloadBtn = document.getElementById('downloadReportBtn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', generateSalesReport);
  }

  // Reset Database Handler
  const resetBtn = document.getElementById('resetDatabase');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (confirm('Are you sure? This will delete all sales history and reset the dashboard to zero.')) {
        try {
          const querySnapshot = await getDocs(collection(db, 'sales'));
          const deletePromises = [];
          querySnapshot.forEach((d) => {
            deletePromises.push(deleteDoc(doc(db, 'sales', d.id)));
          });
          await Promise.all(deletePromises);
          alert('Sales history has been reset.');
          await loadDashboardData();
        } catch (error) {
          console.error('Error resetting database:', error);
          alert('Error: ' + error.message);
        }
      }
    });
  }

  // Load dashboard data
  await loadDashboardData();
});

// Load all dashboard data
async function loadDashboardData() {
  try {
    // Get all sales from Firestore
    const querySnapshot = await getDocs(collection(db, 'sales'));
    const sales = [];

    querySnapshot.forEach((doc) => {
      sales.push({ id: doc.id, ...doc.data() });
    });
    allSales = sales;

    // Calculate statistics
    calculateStatistics(sales);
    
    // Render Sales Chart
    renderSalesChart(sales);

    // Load recent sales
    displayRecentSales(sales);
    
    // Load GST breakdown
    displayGSTBreakdown(sales);

    console.log('Dashboard data loaded:', sales.length, 'sales');
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    document.getElementById('recentSalesTable').innerHTML = '<tr><td colspan="5" style="text-align: center; color: #dc3545;">Error loading data. Check console.</td></tr>';
  }
}

// Calculate and display statistics
function calculateStatistics(sales) {
  if (sales.length === 0) {
    document.getElementById('totalSalesCount').textContent = '0';
    document.getElementById('totalRevenue').textContent = '0.00';
    document.getElementById('totalGST').textContent = '0.00';
    document.getElementById('avgTransaction').textContent = '0.00';
    return;
  }

  // Total sales
  const totalSalesCount = sales.length;
  
  // Total revenue and GST
  let totalRevenue = 0;
  let totalGST = 0;

  sales.forEach(sale => {
    // Calculate revenue from items using cost field (base_cost + gst_amount)
    let saleRevenue = sale.total || 0;
    if (sale.items && Array.isArray(sale.items)) {
      saleRevenue = sale.items.reduce((sum, item) => {
        const cost = parseFloat(item.cost || 0);
        const qty = parseInt(item.quantity || 0);
        const taxRate = parseFloat(item.taxRate || 0);
        return sum + (cost * qty * (1 + taxRate / 100));
      }, 0);
    }
    totalRevenue += saleRevenue;
    totalGST += sale.gstAmount || 0;
  });

  // Average transaction
  const avgTransaction = totalRevenue / totalSalesCount;

  // Update UI
  document.getElementById('totalSalesCount').textContent = totalSalesCount;
  document.getElementById('totalRevenue').textContent = totalRevenue.toFixed(2);
  document.getElementById('totalGST').textContent = totalGST.toFixed(2);
  document.getElementById('avgTransaction').textContent = avgTransaction.toFixed(2);
}

// Display recent sales
function displayRecentSales(sales) {
  const tableBody = document.getElementById('recentSalesTable');
  
  if (sales.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #b0b0b0;">No sales data yet</td></tr>';
    return;
  }

  // Sort by timestamp (newest first) and show last 10
  const sortedSales = sales
    .sort((a, b) => {
      const timeA = a.timestamp?.toDate?.() || new Date(0);
      const timeB = b.timestamp?.toDate?.() || new Date(0);
      return timeB - timeA;
    })
    .slice(0, 10);

  tableBody.innerHTML = sortedSales.map(sale => {
    const timestamp = sale.timestamp?.toDate?.() || new Date();
    const time = timestamp.toLocaleTimeString('en-IN');
    const itemCount = (sale.items || []).length;
    
    // Calculate total from items if stored total is 0 or missing (fixes "Recent Sales showing 0")
    let total = sale.total || 0;
    if (total === 0 && sale.items && sale.items.length > 0) {
      total = sale.items.reduce((sum, item) => {
        const itemCost = parseFloat(item.cost || 0);
        const itemQty = parseInt(item.quantity || 0);
        return sum + (itemCost * itemQty * (1 + (item.taxRate || 0) / 100));
      }, 0);
    }
    
    let rateDisplay = '0%';
    if (sale.subtotal5 > 0 && sale.subtotal18 > 0) rateDisplay = 'Mixed';
    else if (sale.subtotal5 > 0) rateDisplay = '5%';
    else if (sale.subtotal18 > 0) rateDisplay = '18%';
    else if (sale.gstRate) rateDisplay = sale.gstRate + '%';

    const gstAmount = sale.gstAmount || 0;

    return `
      <tr>
        <td>${time}</td>
        <td>${itemCount}</td>
        <td>₹${total.toFixed(2)}</td>
        <td>${rateDisplay}</td>
        <td>₹${gstAmount.toFixed(2)}</td>
      </tr>
    `;
  }).join('');
}

// Display GST breakdown
function displayGSTBreakdown(sales) {
  const tableBody = document.getElementById('gstBreakdownTable');
  
  if (sales.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #b0b0b0;">No sales data yet</td></tr>';
    return;
  }

  // Group by GST rate
  const stats = {
    5: { count: 0, revenue: 0, gstAmount: 0 },
    18: { count: 0, revenue: 0, gstAmount: 0 }
  };

  sales.forEach(sale => {
    if (!sale.items || !Array.isArray(sale.items)) return;

    // Iterate through items to calculate breakdown based on cost and taxRate
    let has5 = false;
    let has18 = false;

    sale.items.forEach(item => {
      const cost = parseFloat(item.cost || 0);
      const qty = parseInt(item.quantity || 0);
      const rate = parseInt(item.taxRate || 0);
      const itemRevenue = cost * qty;
      const itemTax = (itemRevenue * rate) / 100;

      if (stats[rate]) {
        stats[rate].revenue += itemRevenue;
        stats[rate].gstAmount += itemTax;
        stats[rate].count++; // Incrementing item count for this rate
      }
    });
  });

  // Create table rows
  const rows = [5, 18].map(rate => {
      const data = stats[rate];
      return `
        <tr>
          <td>${rate}%</td>
          <td>${data.count}</td>
          <td>₹${data.revenue.toFixed(2)}</td>
          <td>₹${data.gstAmount.toFixed(2)}</td>
        </tr>
      `;
    })
    .join('');

  tableBody.innerHTML = rows;
}

// Generate and download PDF report
function generateSalesReport() {
  if (!window.jspdf) {
    alert('PDF library not loaded. Please refresh the page.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Header
  doc.setFontSize(18);
  doc.text('SmartTax POS - Sales Report', 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

  // Table Data
  const tableColumn = ["Date", "Time", "Customer", "Products", "Total", "GST"];
  const tableRows = [];

  // Sort by date (newest first)
  const sortedSales = [...allSales].sort((a, b) => {
    const timeA = a.timestamp?.toDate?.() || new Date(0);
    const timeB = b.timestamp?.toDate?.() || new Date(0);
    return timeB - timeA;
  });

  sortedSales.forEach(sale => {
    const timestamp = sale.timestamp?.toDate?.() || new Date();
    const dateStr = timestamp.toLocaleDateString('en-IN');
    const timeStr = timestamp.toLocaleTimeString('en-IN');
    
    // Calculate total from items if stored total is 0 or missing
    let total = sale.total || 0;
    if (total === 0 && sale.items && sale.items.length > 0) {
      total = sale.items.reduce((sum, item) => {
        const itemCost = parseFloat(item.cost || 0);
        const itemQty = parseInt(item.quantity || 0);
        return sum + (itemCost * itemQty * (1 + (item.taxRate || 0) / 100));
      }, 0);
    }
    
    const gstAmount = sale.gstAmount || 0;

    const productDetails = (sale.items || []).map(item => `${item.name} (x${item.quantity})`).join(', ');

    tableRows.push([dateStr, timeStr, sale.customerName || 'N/A', productDetails, total.toFixed(2), gstAmount.toFixed(2)]);
  });

  // Generate Table
  doc.autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 35,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] }
  });

  doc.save(`Sales_Report_${Date.now()}.pdf`);
}

// Render Sales Analytics Chart
function renderSalesChart(sales) {
  const ctx = document.getElementById('salesChart');
  if (!ctx) return;

  // Group sales by date (YYYY-MM-DD)
  const salesByDate = {};
  sales.forEach(sale => {
    const dateObj = sale.timestamp?.toDate?.() || new Date();
    const dateKey = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
    
    if (!salesByDate[dateKey]) salesByDate[dateKey] = 0;
    salesByDate[dateKey] += sale.total || 0;
  });

  // Sort dates and prepare data
  const sortedKeys = Object.keys(salesByDate).sort();
  const labels = sortedKeys.map(key => {
    const d = new Date(key);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  });
  const dataPoints = sortedKeys.map(key => salesByDate[key]);

  // Destroy previous chart instance if exists
  if (window.salesChartInstance) {
    window.salesChartInstance.destroy();
  }

  window.salesChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Daily Revenue (₹)',
        data: dataPoints,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#9ca3af' } }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#374151' },
          ticks: { color: '#9ca3af' }
        },
        x: {
          grid: { color: '#374151' },
          ticks: { color: '#9ca3af' }
        }
      }
    }
  });
}