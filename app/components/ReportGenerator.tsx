'use client';

import { useState } from 'react';
import { roundToTwoDecimals } from '@/app/lib/currency-utils';

interface ReportGeneratorProps {
  group: any;
  currentPeriod: any;
  memberContributions: any[];
  oldPeriods: any[];
  formatPeriodName: (period: any) => string;
  selectedPeriodId?: string;
  closedPeriods?: any[];
  showOldContributions?: boolean;
  actualContributions?: Record<string, any>;
}

export default function ReportGenerator({
  group,
  currentPeriod,
  memberContributions,
  oldPeriods,
  formatPeriodName,
  selectedPeriodId,
  closedPeriods = [],
  showOldContributions = false,
  actualContributions = {}
}: ReportGeneratorProps) {
  const [showModal, setShowModal] = useState(false);
  
  // Helper function to get previous period standing
  const getPreviousPeriodStanding = (): number => {
    if (!currentPeriod || !oldPeriods.length) return 0;
    
    // Find the most recent closed period before the current one
    const previousPeriod = oldPeriods
      .filter(p => p.isClosed && p.totalGroupStandingAtEndOfPeriod)
      .sort((a, b) => b.periodNumber - a.periodNumber)
      .find(p => p.periodNumber < currentPeriod.periodNumber);
    
    return previousPeriod?.totalGroupStandingAtEndOfPeriod || 0;
  };
  
  // Function to format currency (consistent with existing app code)
  const formatCurrency = (amount: number | undefined | null): string => {
    const numValue = Number(amount);
    if (isNaN(numValue)) return '₹0.00';
    return `₹${numValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Generate PDF Report
  const generatePDFReport = async () => {
    if (!group) return;
    
    try {
      // Dynamic import to avoid SSR issues
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // === HEADER SECTION ===
      // Group logo area (placeholder for future logo implementation)
      doc.setFillColor(72, 49, 212); // Primary brand color
      doc.rect(0, 0, pageWidth, 35, 'F');
      
      // Main title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(group.name.toUpperCase(), pageWidth / 2, 15, { align: 'center' });
      
      // Subtitle with period info
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      const periodName = showOldContributions && selectedPeriodId 
        ? formatPeriodName(closedPeriods.find(p => p.id === selectedPeriodId))
        : formatPeriodName(currentPeriod);
      doc.text(`GROUP STATEMENT - ${periodName.toUpperCase()}`, pageWidth / 2, 28, { align: 'center' });

      // === GROUP INFO SECTION ===
      doc.setFillColor(248, 249, 250);
      doc.rect(10, 40, pageWidth - 20, 35, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.rect(10, 40, pageWidth - 20, 35, 'S');
      
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      
      // Left column
      doc.setFont('helvetica', 'bold');
      doc.text('Establishment Year:', 15, 50);
      doc.setFont('helvetica', 'normal');
      const establishYear = group.dateOfStarting ? new Date(group.dateOfStarting).getFullYear().toString() : 'N/A';
      doc.text(establishYear, 75, 50);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Total Members:', 15, 58);
      doc.setFont('helvetica', 'normal');
      doc.text(group.memberCount?.toString() || memberContributions.length.toString(), 75, 58);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Collection Frequency:', 15, 66);
      doc.setFont('helvetica', 'normal');
      doc.text(group.collectionFrequency?.toLowerCase().replace('_', ' ') || 'Monthly', 75, 66);
      
      // Right column
      doc.setFont('helvetica', 'bold');
      doc.text('Monthly Contribution:', 110, 50);
      doc.setFont('helvetica', 'normal');
      doc.text(formatCurrency(group.monthlyContribution), 170, 50);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Interest Rate:', 110, 58);
      doc.setFont('helvetica', 'normal');
      doc.text(`${Number(group.interestRate) || 0}% per month`, 170, 58);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Report Generated:', 110, 66);
      doc.setFont('helvetica', 'normal');
      doc.text(new Date().toLocaleDateString('en-IN'), 170, 66);

      // === CALCULATE ALL FINANCIAL DATA ===
      const totalExpected = memberContributions.reduce((sum, c) => sum + (c.totalExpected || 0), 0);
      const totalCollected = memberContributions.reduce((sum, c) => sum + (c.paidAmount || 0), 0);
      const totalCompulsoryContribution = memberContributions.reduce((sum, c) => sum + (c.expectedContribution || 0), 0);
      const totalInterestPaid = memberContributions.reduce((sum, c) => sum + (c.expectedInterest || 0), 0);
      const totalLateFines = memberContributions.reduce((sum, c) => sum + (c.lateFineAmount || 0), 0);
      const totalLoanInsurance = memberContributions.reduce((sum, c) => sum + (c.loanInsuranceAmount || 0), 0);
      const totalGroupSocial = memberContributions.reduce((sum, c) => sum + (c.groupSocialAmount || 0), 0);
      const totalPersonalLoanOutstanding = memberContributions.reduce((sum, c) => sum + (c.currentLoanBalance || 0), 0);
      
      // Calculate cash allocation totals
      const totalCashInHand = Object.values(actualContributions).reduce((sum, record) => {
        if (record.cashAllocation) {
          try {
            const allocation = JSON.parse(record.cashAllocation);
            return sum + (allocation.contributionToCashInHand || 0) + (allocation.interestToCashInHand || 0);
          } catch (_e) { return sum; }
        }
        return sum + Math.ceil((record.totalPaid || 0) * 0.3); // Default 30% to cash
      }, 0);
      
      const totalCashInBank = Object.values(actualContributions).reduce((sum, record) => {
        if (record.cashAllocation) {
          try {
            const allocation = JSON.parse(record.cashAllocation);
            return sum + (allocation.contributionToCashInBank || 0) + (allocation.interestToCashInBank || 0);
          } catch (_e) { return sum; }
        }
        return sum + Math.ceil((record.totalPaid || 0) * 0.7); // Default 70% to bank
      }, 0);

      // Previous month data
      const previousCashInHand = group.cashInHand || 0;
      const previousCashInBank = group.balanceInBank || 0;
      const previousMonthBalance = previousCashInHand + previousCashInBank;
      
      // Calculate Group Standing using the specified formula
      const newCashInGroup = previousMonthBalance + totalCollected;
      const groupSocialFund = totalGroupSocial;
      const loanInsuranceFund = totalLoanInsurance;
      const totalGroupStanding = newCashInGroup + totalPersonalLoanOutstanding - groupSocialFund - loanInsuranceFund;
      const sharePerMember = group.memberCount > 0 ? totalGroupStanding / group.memberCount : 0;
      
      // Get previous period standing to calculate growth
      const previousMonthStanding = getPreviousPeriodStanding();
      const groupMonthlyGrowth = totalGroupStanding - previousMonthStanding;
      
      // === MEMBER CONTRIBUTIONS TABLE ===
      // Create table headers dynamically based on enabled features
      const tableHeaders = ['SL', 'Member Name', 'Compulsory Contribution'];
      const columnWidths = [8, 35, 25];
      
      // Add conditional columns only if they exist in the data
      if (memberContributions.some(m => (m.expectedInterest || 0) > 0)) {
        tableHeaders.push('Personal Loan Interest');
        columnWidths.push(25);
      }
      
      if (memberContributions.some(m => (m.lateFineAmount || 0) > 0)) {
        tableHeaders.push('Late Fine');
        columnWidths.push(18);
      }
      
      if (group.loanInsuranceEnabled && memberContributions.some(m => (m.loanInsuranceAmount || 0) > 0)) {
        tableHeaders.push('Loan Insurance');
        columnWidths.push(20);
      }
      
      if (group.groupSocialEnabled && memberContributions.some(m => (m.groupSocialAmount || 0) > 0)) {
        tableHeaders.push('Group Social');
        columnWidths.push(18);
      }
      
      tableHeaders.push('Total', 'Status');
      columnWidths.push(20, 15);

      // Prepare table data
      const tableData = memberContributions.map((member, index) => {
        const row = [
          (index + 1).toString(),
          member.memberName || '',
          formatCurrency(member.expectedContribution)
        ];
        
        // Add conditional data columns
        if (memberContributions.some(m => (m.expectedInterest || 0) > 0)) {
          row.push(formatCurrency(member.expectedInterest));
        }
        
        if (memberContributions.some(m => (m.lateFineAmount || 0) > 0)) {
          row.push(formatCurrency(member.lateFineAmount || 0));
        }
        
        if (group.loanInsuranceEnabled && memberContributions.some(m => (m.loanInsuranceAmount || 0) > 0)) {
          row.push(formatCurrency(member.loanInsuranceAmount || 0));
        }
        
        if (group.groupSocialEnabled && memberContributions.some(m => (m.groupSocialAmount || 0) > 0)) {
          row.push(formatCurrency(member.groupSocialAmount || 0));
        }
        
        row.push(formatCurrency(member.totalExpected));
        row.push(member.status === 'PAID' ? '✓' : member.status === 'PARTIAL' ? '~' : '✗');
        
        return row;
      });

      // Create totals row
      const totalsRow = ['', 'TOTAL', formatCurrency(totalCompulsoryContribution)];
      
      // Add conditional totals
      if (memberContributions.some(m => (m.expectedInterest || 0) > 0)) {
        totalsRow.push(formatCurrency(totalInterestPaid));
      }
      
      if (memberContributions.some(m => (m.lateFineAmount || 0) > 0)) {
        totalsRow.push(formatCurrency(totalLateFines));
      }
      
      if (group.loanInsuranceEnabled && memberContributions.some(m => (m.loanInsuranceAmount || 0) > 0)) {
        totalsRow.push(formatCurrency(totalLoanInsurance));
      }
      
      if (group.groupSocialEnabled && memberContributions.some(m => (m.groupSocialAmount || 0) > 0)) {
        totalsRow.push(formatCurrency(totalGroupSocial));
      }
      
      totalsRow.push(formatCurrency(totalExpected));
      totalsRow.push(`${memberContributions.filter(c => c.status === 'PAID').length}/${memberContributions.length}`);

      // Generate the main table
      autoTable(doc, {
        startY: 85,
        head: [tableHeaders],
        body: [...tableData, totalsRow],
        headStyles: {
          fillColor: [72, 49, 212],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 2
        },
        columnStyles: Object.fromEntries(
          columnWidths.map((width, index) => [index, { cellWidth: width }])
        ),
        alternateRowStyles: {
          fillColor: [250, 250, 250]
        },
        didParseCell: function(data) {
          // Style the totals row
          if (data.row.index === tableData.length) {
            data.cell.styles.fillColor = [240, 240, 240];
            data.cell.styles.fontStyle = 'bold';
          }
          
          // Style status column with colors
          const statusColIndex = tableHeaders.length - 1;
          if (data.column.index === statusColIndex && data.section === 'body' && data.row.index < tableData.length) {
            const status = data.cell.raw;
            if (status === '✓') {
              data.cell.styles.textColor = [46, 125, 50]; // Green
            } else if (status === '~') {
              data.cell.styles.textColor = [198, 130, 0]; // Orange
            } else if (status === '✗') {
              data.cell.styles.textColor = [198, 40, 40]; // Red
            }
          }
        }
      });

      // === GROUP CASH SUMMARY SECTION ===
      const tableEndY = (doc as any).lastAutoTable.finalY || 200;
      let summaryY = tableEndY + 20;
      
      // Check if we need a new page
      if (summaryY > 220) {
        doc.addPage();
        summaryY = 20;
      }
      
      // Section header
      doc.setFillColor(72, 49, 212);
      doc.rect(10, summaryY, pageWidth - 20, 15, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('GROUP CASH SUMMARY', 15, summaryY + 10);
      
      summaryY += 20;
      
      // Create cash summary table
      const cashSummaryData = [
        ['PREVIOUS MONTH', '', ''],
        ['Cash in Hand', formatCurrency(previousCashInHand), ''],
        ['Cash in Bank', formatCurrency(previousCashInBank), ''],
        ['Total Previous Balance', formatCurrency(previousMonthBalance), ''],
        ['', '', ''],
        ['THIS MONTH COLLECTION', '', ''],
        ['Monthly Contribution', formatCurrency(totalCompulsoryContribution), ''],
        ['Interest on Personal Loan', formatCurrency(totalInterestPaid), '']
      ];

      // Add conditional rows
      if (totalLateFines > 0) {
        cashSummaryData.push(['Late Fine', formatCurrency(totalLateFines), '']);
      }
      
      if (group.loanInsuranceEnabled && totalLoanInsurance > 0) {
        cashSummaryData.push(['Loan Insurance', formatCurrency(totalLoanInsurance), '']);
      }
      
      if (group.groupSocialEnabled && totalGroupSocial > 0) {
        cashSummaryData.push(['Group Social', formatCurrency(totalGroupSocial), '']);
      }

      cashSummaryData.push(
        ['Total Collection This Month', formatCurrency(totalCollected), ''],
        ['', '', ''],
        ['CASH ALLOCATION', '', ''],
        ['Cash in Hand', formatCurrency(totalCashInHand), ''],
        ['Cash in Bank', formatCurrency(totalCashInBank), ''],
        ['', '', ''],
        ['NEW TOTALS', '', ''],
        ['New Cash in Hand', formatCurrency(previousCashInHand + totalCashInHand), ''],
        ['New Cash in Bank', formatCurrency(previousCashInBank + totalCashInBank), ''],
        ['Personal Loan Outstanding', formatCurrency(totalPersonalLoanOutstanding), '']
      );

      // Add fund rows if applicable
      if (group.groupSocialEnabled && totalGroupSocial > 0) {
        cashSummaryData.push(['Group Social Fund', formatCurrency(totalGroupSocial), '']);
      }
      
      if (group.loanInsuranceEnabled && totalLoanInsurance > 0) {
        cashSummaryData.push(['Loan Insurance Fund', formatCurrency(totalLoanInsurance), '']);
      }

      // Add group standing calculations
      cashSummaryData.push(
        ['', '', ''],
        ['TOTAL GROUP STANDING', '', ''],
        ['New Cash in Group', formatCurrency(newCashInGroup), ''],
        ['+ Personal Loan Outstanding', formatCurrency(totalPersonalLoanOutstanding), '']
      );

      // Add conditional fund deductions
      if (groupSocialFund > 0) {
        cashSummaryData.push(['- Group Social Fund', formatCurrency(groupSocialFund), '']);
      }
      
      if (loanInsuranceFund > 0) {
        cashSummaryData.push(['- Loan Insurance Fund', formatCurrency(loanInsuranceFund), '']);
      }
      
      // Add total standing and share per member
      cashSummaryData.push(
        ['= TOTAL GROUP STANDING', formatCurrency(totalGroupStanding), ''],
        ['', '', ''],
        ['Share per Member', formatCurrency(sharePerMember), `(${formatCurrency(totalGroupStanding)} ÷ ${group.memberCount})`]
      );

      // Add group monthly growth
      if (previousMonthStanding > 0) {
        cashSummaryData.push(
          ['', '', ''],
          ['Group Monthly Growth', formatCurrency(groupMonthlyGrowth), `(${formatCurrency(totalGroupStanding)} - ${formatCurrency(previousMonthStanding)})`]
        );
      }

      // Generate cash summary table
      autoTable(doc, {
        startY: summaryY,
        body: cashSummaryData,
        columnStyles: {
          0: { cellWidth: 50, fontStyle: 'bold' },
          1: { cellWidth: 35, halign: 'right' },
          2: { cellWidth: 40, fontSize: 7, textColor: [100, 100, 100] }
        },
        bodyStyles: {
          fontSize: 9,
          cellPadding: 1.5
        },
        didParseCell: function(data) {
          const cellValue = String(data.cell.raw || '');
          
          // Style header rows
          if (cellValue === 'PREVIOUS MONTH' || 
              cellValue === 'THIS MONTH COLLECTION' ||
              cellValue === 'CASH ALLOCATION' || 
              cellValue === 'NEW TOTALS' ||
              cellValue === 'TOTAL GROUP STANDING') {
            data.cell.styles.fillColor = [240, 248, 255];
            data.cell.styles.fontStyle = 'bold';
          }
          
          // Style the final total row
          if (cellValue === '= TOTAL GROUP STANDING') {
            data.cell.styles.fillColor = [72, 49, 212];
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = 'bold';
          }
          
          // Style the monthly growth row
          if (cellValue === 'Group Monthly Growth') {
            data.cell.styles.fillColor = [230, 255, 230];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });

      // === FOOTER ===
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(
          `Generated on ${new Date().toLocaleString('en-IN')} | Page ${i} of ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      // Save the PDF
      const fileName = `${group.name.replace(/[^a-zA-Z0-9]/g, '_')}_Statement_${periodName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      setShowModal(false);
      
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Error generating PDF: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  // Generate Excel Report
  const generateExcelReport = async () => {
    // Implementation here
    alert('Excel report generation will be implemented soon.');
    setShowModal(false);
  };

  // Generate CSV Report
  const generateCSVReport = () => {
    // Implementation here
    alert('CSV report generation will be implemented soon.');
    setShowModal(false);
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="btn-secondary bg-purple-100 hover:bg-purple-200 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:hover:bg-purple-800/50 dark:text-purple-300 dark:border-purple-700/50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Generate Report
      </button>

      {/* Report Generation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Generate Report</h3>
              <p className="text-sm text-muted mb-6">
                Select the format for your report. The report will include all relevant group data and financial calculations.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={generatePDFReport}
                  className="btn-secondary flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  PDF
                </button>
                <button
                  onClick={generateExcelReport}
                  className="btn-secondary flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Excel
                </button>
                <button
                  onClick={generateCSVReport}
                  className="btn-secondary flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  CSV
                </button>
              </div>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700/50 px-6 py-4 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
