// Admin Dashboard Logic - ES Module
import { db, auth } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.2/firebase-auth.js';
import { collection, getDocs, query, where, Timestamp } from 'https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js';

// Initialize admin page on load
document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = 'index.html';
    }
  });

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

    // Calculate statistics
    calculateStatistics(sales);
    
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
    totalRevenue += sale.total || 0;
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
    const total = sale.total || 0;
    
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
    // Handle 5%
    if (sale.subtotal5 > 0 || sale.tax5Total > 0) {
      stats[5].count++;
      stats[5].revenue += (sale.subtotal5 || 0);
      stats[5].gstAmount += (sale.tax5Total || 0);
    } else if (sale.gstRate === 5) { // Legacy support
      stats[5].count++;
      stats[5].revenue += (sale.total - sale.gstAmount);
      stats[5].gstAmount += sale.gstAmount;
    }

    // Handle 18%
    if (sale.subtotal18 > 0 || sale.tax18Total > 0) {
      stats[18].count++;
      stats[18].revenue += (sale.subtotal18 || 0);
      stats[18].gstAmount += (sale.tax18Total || 0);
    } else if (sale.gstRate === 18) { // Legacy support
      stats[18].count++;
      stats[18].revenue += (sale.total - sale.gstAmount);
      stats[18].gstAmount += sale.gstAmount;
    }
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
