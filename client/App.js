import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  Dimensions,
  Platform,
  Alert,
  Image,
  Linking
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Live Vercel Backend Cloud API
const DEFAULT_API_BASE = 'https://admincopy-tau.vercel.app/api';

export default function App() {
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [customApiInput, setCustomApiInput] = useState('');
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedKiosk, setSelectedKiosk] = useState('ALL');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedJob, setSelectedJob] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [dbConnected, setDbConnected] = useState(false);
  const [jsonViewActive, setJsonViewActive] = useState(false);
  const [printingJobId, setPrintingJobId] = useState(null);
  const [printStatusMessage, setPrintStatusMessage] = useState('');

  // New Job Form State for testing
  const [newJobForm, setNewJobForm] = useState({
    jobId: `EXP-${Math.floor(1000 + Math.random() * 9000)}`,
    kioskId: 'KIOSK-01',
    fileName: 'document_print.pdf',
    fileSizeMB: 0.15,
    fileType: 'pdf',
    totalPages: 5,
    pageRange: '1-5',
    pagesToPrintCount: 5,
    isColor: false,
    isDuplex: false,
    copies: 1,
    paperSize: 'A4',
    layoutMode: '1-Up',
    pinToken: `PIN-${Math.floor(1000 + Math.random() * 9000)}`,
    totalCost: 15,
    status: 'PRINTING',
    paymentStatus: 'SUCCESS',
    transactionId: `TXN-${Math.random().toString(36).substr(2, 7).toUpperCase()}`
  });

  // Fetch Jobs & Stats from MongoDB API
  const fetchData = async (showLoadingSpinner = false) => {
    if (showLoadingSpinner) setLoading(true);
    try {
      // 1. Fetch Print Jobs
      const queryParams = new URLSearchParams({
        sortBy,
        order: sortOrder,
        ...(selectedStatus !== 'ALL' && { status: selectedStatus }),
        ...(selectedKiosk !== 'ALL' && { kioskId: selectedKiosk }),
        ...(searchQuery.trim() && { q: searchQuery.trim() })
      });

      const [jobsRes, statsRes, healthRes] = await Promise.all([
        fetch(`${apiBaseUrl}/printjobs?${queryParams.toString()}`),
        fetch(`${apiBaseUrl}/stats`),
        fetch(`${apiBaseUrl}/health`).catch(() => ({ ok: false }))
      ]);

      if (healthRes.ok) {
        setDbConnected(true);
      } else {
        setDbConnected(false);
      }

      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setJobs(jobsData.jobs || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats || null);
      }
    } catch (err) {
      console.error('Error fetching data from MongoDB backend:', err);
      setDbConnected(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData(true);
  }, [selectedStatus, selectedKiosk, sortBy, sortOrder]);

  // Handle Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Auto Refresh Polling
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchData(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedStatus, selectedKiosk, searchQuery]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(false);
  };

  // Update Status
  const handleUpdateStatus = async (jobId, newStatus) => {
    try {
      const res = await fetch(`${apiBaseUrl}/printjobs/${jobId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchData(false);
        if (selectedJob && selectedJob._id === jobId) {
          setSelectedJob(prev => ({ ...prev, status: newStatus }));
        }
      }
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  // Delete Job
  const handleDeleteJob = async (jobId) => {
    const confirmDelete = Platform.OS === 'web' 
      ? window.confirm('Are you sure you want to delete this print job from MongoDB?')
      : true;

    if (!confirmDelete) return;

    try {
      const res = await fetch(`${apiBaseUrl}/printjobs/${jobId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setDetailModalVisible(false);
        fetchData(false);
      }
    } catch (err) {
      console.error('Failed to delete job', err);
    }
  };

  // Create Test Job
  const handleCreateTestJob = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/printjobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newJobForm)
      });
      if (res.ok) {
        setAddModalVisible(false);
        fetchData(false);
        // Reset form
        setNewJobForm({
          jobId: `EXP-${Math.floor(1000 + Math.random() * 9000)}`,
          kioskId: 'KIOSK-01',
          fileName: 'sample_doc_' + Math.floor(Math.random() * 100) + '.pdf',
          fileSizeMB: (Math.random() * 0.5 + 0.05).toFixed(2),
          fileType: 'pdf',
          totalPages: Math.floor(Math.random() * 10) + 1,
          pageRange: '1-5',
          pagesToPrintCount: 5,
          isColor: Math.random() > 0.5,
          isDuplex: false,
          copies: 1,
          paperSize: 'A4',
          layoutMode: '1-Up',
          pinToken: `PIN-${Math.floor(1000 + Math.random() * 9000)}`,
          totalCost: 20,
          status: 'PRINTING',
          paymentStatus: 'SUCCESS',
          transactionId: `TXN-${Math.random().toString(36).substr(2, 7).toUpperCase()}`
        });
      }
    } catch (err) {
      console.error('Failed to create job', err);
    }
  };

  // --- CLOUDINARY FILE DOWNLOAD & OTG PRINTING LOGIC ---
  const handlePrintJob = async (job) => {
    const fileUrl = job?.cloudinaryUrl || job?.filePreviewData || job?.fileUrl || job?.url;

    if (!fileUrl) {
      const msg = `Job ${job?.jobId || ''} does not have a Cloudinary URL or file attached.`;
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('No Document Attached', msg);
      }
      return;
    }

    setPrintingJobId(job._id || job.jobId);
    setPrintStatusMessage(`Downloading & Preparing ${job.fileName || 'document'}...`);

    try {
      const isPdf = (job.fileType && job.fileType.toLowerCase() === 'pdf') ||
                    (job.fileName && job.fileName.toLowerCase().endsWith('.pdf')) ||
                    fileUrl.toLowerCase().includes('.pdf');

      // Update status to PRINTING in MongoDB
      if (job.status !== 'PRINTING' && job.status !== 'COMPLETED') {
        handleUpdateStatus(job._id, 'PRINTING');
      }

      const isGrayscale = !job.isColor || job.filterMode === 'bw' || job.filterMode === 'grayscale';
      const rotationAngle = job.rotation || 0;
      const paper = job.paperSize || 'A4';
      const isLandscape = rotationAngle === 90 || rotationAngle === 270;

      if (Platform.OS === 'web') {
        setPrintStatusMessage('Routing to USB / OTG / System Printer...');
        if (!isPdf) {
          const htmlContent = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <title>Print - ${job.jobId} - ${job.fileName || 'Document'}</title>
                <style>
                  @page {
                    size: ${paper} ${isLandscape ? 'landscape' : 'portrait'};
                    margin: 0mm;
                  }
                  * { box-sizing: border-box; }
                  body, html {
                    margin: 0;
                    padding: 0;
                    width: 100%;
                    height: 100%;
                    background: #ffffff;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                  }
                  .print-container {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 8mm;
                  }
                  img {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                    ${isGrayscale ? 'filter: grayscale(100%) contrast(110%); -webkit-filter: grayscale(100%) contrast(110%);' : ''}
                    ${rotationAngle ? `transform: rotate(${rotationAngle}deg);` : ''}
                  }
                </style>
              </head>
              <body>
                <div class="print-container">
                  <img src="${fileUrl}" onload="setTimeout(function(){ window.print(); }, 400);" />
                </div>
              </body>
            </html>
          `;

          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(htmlContent);
            printWindow.document.close();
          } else {
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            document.body.appendChild(iframe);
            iframe.contentDocument.write(htmlContent);
            iframe.contentDocument.close();
            iframe.contentWindow.focus();
            setTimeout(() => {
              iframe.contentWindow.print();
              setTimeout(() => {
                if (document.body.contains(iframe)) document.body.removeChild(iframe);
              }, 2000);
            }, 800);
          }
        } else {
          const pdfWindow = window.open(fileUrl, '_blank');
          if (pdfWindow) {
            pdfWindow.focus();
            setTimeout(() => {
              try { pdfWindow.print(); } catch (e) {}
            }, 1000);
          }
        }

        setPrintStatusMessage('Print job sent to system spooler!');
        setTimeout(() => setPrintingJobId(null), 2500);

      } else {
        // Native Android / iOS (OTG Cable / USB Print via Android Print Service)
        setPrintStatusMessage('Downloading file from Cloudinary...');

        if (!isPdf) {
          const html = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
                <style>
                  @page {
                    size: ${paper} ${isLandscape ? 'landscape' : 'portrait'};
                    margin: 0mm;
                  }
                  body {
                    margin: 0;
                    padding: 0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    background-color: #ffffff;
                  }
                  img {
                    max-width: 100%;
                    max-height: 100vh;
                    object-fit: contain;
                    ${isGrayscale ? 'filter: grayscale(100%) contrast(110%);' : ''}
                    ${rotationAngle ? `transform: rotate(${rotationAngle}deg);` : ''}
                  }
                </style>
              </head>
              <body>
                <img src="${fileUrl}" />
              </body>
            </html>
          `;

          setPrintStatusMessage('Sending to OTG / USB Cable Printer...');
          await Print.printAsync({
            html,
            orientation: isLandscape ? Print.Orientation.landscape : Print.Orientation.portrait,
          });

        } else {
          const ext = 'pdf';
          const localUri = `${FileSystem.cacheDirectory}print_${job.jobId || Date.now()}.${ext}`;
          
          setPrintStatusMessage('Caching PDF locally...');
          const downloadRes = await FileSystem.downloadAsync(fileUrl, localUri);
          
          setPrintStatusMessage('Sending to OTG / USB Cable Printer...');
          await Print.printAsync({
            uri: downloadRes.uri,
            orientation: isLandscape ? Print.Orientation.landscape : Print.Orientation.portrait,
          });
        }

        setPrintStatusMessage('✅ Sent to OTG Printer!');
        setTimeout(() => setPrintingJobId(null), 3000);
      }
    } catch (err) {
      console.error('Print error:', err);
      const errMsg = err.message || 'Failed to communicate with printer via OTG / USB cable.';
      if (Platform.OS === 'web') {
        window.alert(`Print Error: ${errMsg}`);
      } else {
        Alert.alert('Print Error', errMsg);
      }
      setPrintingJobId(null);
    }
  };

  // Download File to Device
  const handleDownloadFile = async (job) => {
    const fileUrl = job?.cloudinaryUrl || job?.filePreviewData || job?.fileUrl || job?.url;
    if (!fileUrl) {
      Alert.alert('Error', 'No Cloudinary file URL found.');
      return;
    }

    try {
      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = job.fileName || 'download';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const ext = job.fileType || 'jpg';
        const localUri = `${FileSystem.documentDirectory}${job.fileName || `file_${job.jobId}.${ext}`}`;
        const downloadRes = await FileSystem.downloadAsync(fileUrl, localUri);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadRes.uri);
        } else {
          Alert.alert('Downloaded', `Saved to ${downloadRes.uri}`);
        }
      }
    } catch (err) {
      console.error('Download error:', err);
      Alert.alert('Download Error', err.message);
    }
  };

  const handleOpenUrl = (url) => {
    if (!url) return;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(err => {
        Alert.alert('Cannot Open URL', err.message);
      });
    }
  };

  // Extract unique kiosk list for filter
  const kioskList = useMemo(() => {
    const set = new Set(['ALL']);
    jobs.forEach(j => {
      if (j.kioskId) set.add(j.kioskId);
    });
    return Array.from(set);
  }, [jobs]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const d = new Date(dateString);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateString;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" translucent={false} />
      
      {/* --- TOP HEADER WRAPPER --- */}
      <View style={styles.headerWrapper}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoBadge}>
              <MaterialCommunityIcons name="printer-pos-outline" size={18} color="#ffffff" />
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>ECOPY ADMIN</Text>
              <View style={styles.dbStatusRow}>
                <View style={[styles.statusDot, { backgroundColor: dbConnected ? '#22c55e' : '#52525b' }]} />
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {dbConnected ? 'ATLAS LIVE' : 'CONNECTING...'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => {
                setCustomApiInput(apiBaseUrl);
                setSettingsModalVisible(true);
              }}
              title="Backend Settings"
            >
              <Ionicons name="settings-outline" size={15} color="#ffffff" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.iconButton, autoRefresh && styles.iconButtonActive]}
              onPress={() => setAutoRefresh(!autoRefresh)}
              title="Auto-refresh"
            >
              <MaterialCommunityIcons 
                name={autoRefresh ? "sync" : "sync-off"} 
                size={14} 
                color={autoRefresh ? "#000000" : "#a1a1aa"} 
              />
              <Text style={[styles.autoRefreshText, autoRefresh && { color: '#000000' }]}>
                {autoRefresh ? '5s' : 'OFF'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => setAddModalVisible(true)}
            >
              <Ionicons name="add" size={16} color="#000000" />
              <Text style={styles.actionButtonText}>NEW</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* --- MAIN SCROLL CONTENT --- */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" colors={['#ffffff']} />
        }
      >
        {/* --- GLOBAL OTG PRINTING NOTIFICATION BANNER --- */}
        {printingJobId && (
          <View style={styles.printNotificationBanner}>
            <ActivityIndicator size="small" color="#000000" style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.printNotificationTitle}>OTG / USB PRINTER DISPATCH</Text>
              <Text style={styles.printNotificationText}>
                {printStatusMessage || 'Processing Cloudinary document & sending to printer...'}
              </Text>
            </View>
          </View>
        )}

        {/* --- LIVE STATS STRIP --- */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>TOTAL JOBS</Text>
              <MaterialCommunityIcons name="folder-multiple-outline" size={16} color="#a1a1aa" />
            </View>
            <Text style={styles.statValue}>{stats?.totalJobs ?? jobs.length}</Text>
          </View>

          <View style={[styles.statCard, styles.statCardActive]}>
            <View style={styles.statHeader}>
              <Text style={[styles.statLabel, { color: '#ffffff', fontWeight: '700' }]}>PRINTING NOW</Text>
              <View style={styles.liveBadge}>
                <View style={styles.liveInnerDot} />
              </View>
            </View>
            <Text style={[styles.statValue, { color: '#ffffff' }]}>
              {stats?.printingJobs ?? jobs.filter(j => j.status === 'PRINTING').length}
            </Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>COMPLETED</Text>
              <MaterialCommunityIcons name="check-circle-outline" size={16} color="#a1a1aa" />
            </View>
            <Text style={styles.statValue}>
              {stats?.completedJobs ?? jobs.filter(j => j.status === 'COMPLETED').length}
            </Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>REVENUE</Text>
              <MaterialCommunityIcons name="currency-inr" size={16} color="#a1a1aa" />
            </View>
            <Text style={styles.statValue}>₹{stats?.totalRevenue ?? 0}</Text>
          </View>
        </View>

        {/* --- SEARCH & QUICK CONTROLS --- */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#71717a" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search Job ID, File Name, PIN, Transaction..."
              placeholderTextColor="#52525b"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={16} color="#71717a" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.refreshIconBtn} onPress={() => fetchData(true)}>
            <Ionicons name="refresh" size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* --- STATUS FILTER PILLS --- */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
          {['ALL', 'PRINTING', 'PENDING', 'COMPLETED', 'FAILED'].map((status) => {
            const isSelected = selectedStatus === status;
            return (
              <TouchableOpacity
                key={status}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                onPress={() => setSelectedStatus(status)}
              >
                {status === 'PRINTING' && <View style={[styles.filterDot, isSelected && { backgroundColor: '#000000' }]} />}
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {status}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* --- KIOSK LOCATION FILTER --- */}
        {kioskList.length > 1 && (
          <View style={styles.kioskFilterRow}>
            <Text style={styles.kioskFilterLabel}>KIOSK:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {kioskList.map((kiosk) => (
                <TouchableOpacity
                  key={kiosk}
                  style={[styles.kioskChip, selectedKiosk === kiosk && styles.kioskChipActive]}
                  onPress={() => setSelectedKiosk(kiosk)}
                >
                  <Text style={[styles.kioskChipText, selectedKiosk === kiosk && styles.kioskChipTextActive]}>
                    {kiosk}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* --- JOBS LIST HEADER --- */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.listHeaderTitle}>
            DATABASE DOCUMENTS ({jobs.length})
          </Text>
          <View style={styles.sortContainer}>
            <TouchableOpacity 
              style={styles.sortButton}
              onPress={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            >
              <Text style={styles.sortButtonText}>
                {sortOrder === 'desc' ? 'NEWEST FIRST' : 'OLDEST FIRST'}
              </Text>
              <Ionicons 
                name={sortOrder === 'desc' ? "arrow-down" : "arrow-up"} 
                size={12} 
                color="#a1a1aa" 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* --- LOADING INDICATOR --- */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.loadingText}>Fetching documents from MongoDB Atlas...</Text>
          </View>
        )}

        {/* --- EMPTY STATE --- */}
        {!loading && jobs.length === 0 && (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="printer-alert" size={54} color="#3f3f46" />
            <Text style={styles.emptyTitle}>No Print Jobs Found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? `No records matching "${searchQuery}"` : 'No print jobs registered in ecopy.printjobs collection.'}
            </Text>
            <TouchableOpacity 
              style={styles.createFirstBtn}
              onPress={() => setAddModalVisible(true)}
            >
              <Text style={styles.createFirstBtnText}>+ INSERT TEST JOB</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* --- PRINT JOB CARDS --- */}
        {!loading && jobs.map((job) => {
          const isPrinting = job.status === 'PRINTING';
          const isCompleted = job.status === 'COMPLETED';
          const isFailed = job.status === 'FAILED' || job.status === 'CANCELLED';

          return (
            <TouchableOpacity
              key={job._id || job.jobId}
              style={[styles.jobCard, isPrinting && styles.jobCardPrinting]}
              activeOpacity={0.85}
              onPress={() => {
                setSelectedJob(job);
                setDetailModalVisible(true);
              }}
            >
              {/* Card Top Row */}
              <View style={styles.cardHeader}>
                <View style={styles.idGroup}>
                  <View style={styles.jobIdBadge}>
                    <Text style={styles.jobIdText}>{job.jobId || 'NO-ID'}</Text>
                  </View>
                  {job.pinToken && (
                    <View style={styles.pinBadge}>
                      <Ionicons name="key-outline" size={11} color="#a1a1aa" style={{ marginRight: 3 }} />
                      <Text style={styles.pinText}>PIN: {job.pinToken}</Text>
                    </View>
                  )}
                  {job.kioskId && (
                    <View style={styles.kioskBadge}>
                      <Text style={styles.kioskText}>{job.kioskId}</Text>
                    </View>
                  )}
                </View>

                {/* Status Indicator */}
                <View style={[
                  styles.statusTag,
                  isPrinting && styles.statusTagPrinting,
                  isCompleted && styles.statusTagCompleted,
                  isFailed && styles.statusTagFailed
                ]}>
                  {isPrinting && <View style={styles.pulseDot} />}
                  {isCompleted && <Ionicons name="checkmark" size={12} color="#ffffff" style={{ marginRight: 3 }} />}
                  <Text style={[
                    styles.statusTagText,
                    isPrinting && { color: '#ffffff', fontWeight: '800' },
                    isCompleted && { color: '#ffffff' }
                  ]}>
                    {job.status || 'PENDING'}
                  </Text>
                </View>
              </View>

              {/* File Information */}
              <View style={styles.fileRow}>
                <View style={styles.fileIconWrapper}>
                  <MaterialCommunityIcons 
                    name={job.fileType === 'pdf' ? "file-pdf-box" : "file-image-outline"} 
                    size={28} 
                    color="#ffffff" 
                  />
                </View>
                <View style={styles.fileDetails}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {job.fileName || 'Untitled Document'}
                  </Text>
                  <Text style={styles.fileMeta}>
                    {job.fileType ? job.fileType.toUpperCase() : 'PDF'} • {job.fileSizeMB ? `${job.fileSizeMB} MB` : 'Size N/A'}
                  </Text>
                </View>
              </View>

              {/* Print Configuration Details Grid */}
              <View style={styles.specsGrid}>
                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>PAGES</Text>
                  <Text style={styles.specValue}>{job.pagesToPrintCount || job.totalPages || 1} pgs ({job.pageRange || 'All'})</Text>
                </View>

                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>COPIES / SIZE</Text>
                  <Text style={styles.specValue}>{job.copies || 1}x • {job.paperSize || 'A4'}</Text>
                </View>

                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>COLOR / MODE</Text>
                  <Text style={styles.specValue}>
                    {job.isColor ? 'Color' : 'B&W'} • {job.isDuplex ? '2-Sided' : '1-Sided'}
                  </Text>
                </View>

                <View style={styles.specItem}>
                  <Text style={styles.specLabel}>AMOUNT</Text>
                  <Text style={[styles.specValue, styles.costValue]}>₹{job.totalCost || 0}</Text>
                </View>
              </View>

              {/* Cloudinary & Quick OTG Print Action Bar */}
              <View style={styles.cardActionBar}>
                {job.cloudinaryUrl || job.filePreviewData ? (
                  <View style={styles.cloudinaryBadge}>
                    <Ionicons name="cloud-done-outline" size={12} color="#38bdf8" style={{ marginRight: 4 }} />
                    <Text style={styles.cloudinaryBadgeText} numberOfLines={1}>CLOUD READY</Text>
                  </View>
                ) : (
                  <View style={[styles.cloudinaryBadge, { backgroundColor: '#1c1c20', borderColor: '#27272a' }]}>
                    <Ionicons name="cloud-offline-outline" size={12} color="#71717a" style={{ marginRight: 4 }} />
                    <Text style={[styles.cloudinaryBadgeText, { color: '#71717a' }]} numberOfLines={1}>NO FILE</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.cardPrintButton,
                    printingJobId === (job._id || job.jobId) && styles.cardPrintButtonActive
                  ]}
                  onPress={(e) => {
                    if (e && e.stopPropagation) e.stopPropagation();
                    handlePrintJob(job);
                  }}
                  disabled={printingJobId === (job._id || job.jobId)}
                  activeOpacity={0.8}
                >
                  {printingJobId === (job._id || job.jobId) ? (
                    <ActivityIndicator size="small" color="#000000" style={{ marginRight: 4 }} />
                  ) : (
                    <MaterialCommunityIcons name="printer-pos" size={14} color="#000000" style={{ marginRight: 4 }} />
                  )}
                  <Text style={styles.cardPrintButtonText}>
                    {printingJobId === (job._id || job.jobId) ? 'PRINTING...' : 'PRINT (OTG)'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Footer Meta Row */}
              <View style={styles.cardFooter}>
                <View style={styles.timestampRow}>
                  <Feather name="clock" size={12} color="#71717a" style={{ marginRight: 4 }} />
                  <Text style={styles.timestampText}>
                    {formatDate(job.createdAt)}
                  </Text>
                  {job.paymentMethod && (
                    <Text style={styles.paymentMethodTag}>
                      {job.paymentMethod} • {job.paymentStatus}
                    </Text>
                  )}
                </View>

                <View style={styles.previewPrompt}>
                  <Text style={styles.previewPromptText}>INSPECT</Text>
                  <Ionicons name="chevron-forward" size={14} color="#a1a1aa" />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* --- DETAILED INSPECTOR MODAL --- */}
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedJob && (
              <>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <View>
                    <View style={styles.modalTitleRow}>
                      <Text style={styles.modalTitle}>{selectedJob.jobId}</Text>
                      <View style={[styles.statusTag, styles.statusTagActiveModal]}>
                        <Text style={styles.statusTagText}>{selectedJob.status}</Text>
                      </View>
                    </View>
                    <Text style={styles.modalSubtitle}>_id: {selectedJob._id}</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.modalCloseBtn}
                    onPress={() => setDetailModalVisible(false)}
                  >
                    <Ionicons name="close" size={20} color="#ffffff" />
                  </TouchableOpacity>
                </View>

                {/* View Switcher (UI Specs vs Raw MongoDB JSON) */}
                <View style={styles.tabSwitcher}>
                  <TouchableOpacity 
                    style={[styles.tabButton, !jsonViewActive && styles.tabButtonActive]}
                    onPress={() => setJsonViewActive(false)}
                  >
                    <Ionicons name="layers-outline" size={15} color={!jsonViewActive ? '#000000' : '#a1a1aa'} />
                    <Text style={[styles.tabButtonText, !jsonViewActive && styles.tabButtonTextActive]}>
                      Document Specs
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.tabButton, jsonViewActive && styles.tabButtonActive]}
                    onPress={() => setJsonViewActive(true)}
                  >
                    <Ionicons name="code-slash" size={15} color={jsonViewActive ? '#000000' : '#a1a1aa'} />
                    <Text style={[styles.tabButtonText, jsonViewActive && styles.tabButtonTextActive]}>
                      MongoDB JSON Tree
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Modal Body */}
                <ScrollView style={styles.modalScroll}>
                  {!jsonViewActive ? (
                    <View style={styles.detailsContainer}>
                      {/* Cloudinary & OTG Hardware Dispatch Card */}
                      <View style={styles.cloudinarySection}>
                        <View style={styles.cloudinaryHeaderRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <MaterialCommunityIcons name="cloud-sync-outline" size={18} color="#38bdf8" style={{ marginRight: 6 }} />
                            <Text style={styles.cloudinaryHeaderTitle}>CLOUDINARY & OTG PRINT</Text>
                          </View>
                          <View style={styles.otgStatusTag}>
                            <Ionicons name="hardware-chip-outline" size={12} color="#4ade80" style={{ marginRight: 4 }} />
                            <Text style={styles.otgStatusTagText}>OTG CABLE READY</Text>
                          </View>
                        </View>

                        {selectedJob.cloudinaryUrl || selectedJob.filePreviewData ? (
                          <>
                            {/* Preview Thumbnail if image */}
                            {(selectedJob.fileType?.toLowerCase() !== 'pdf' && 
                              !(selectedJob.fileName && selectedJob.fileName.toLowerCase().endsWith('.pdf'))) && (
                              <View style={styles.previewImageWrapper}>
                                <Image
                                  source={{ uri: selectedJob.cloudinaryUrl || selectedJob.filePreviewData }}
                                  style={styles.modalImageThumbnail}
                                  resizeMode="contain"
                                />
                              </View>
                            )}

                            <DetailRow 
                              label="Cloudinary URL" 
                              value={selectedJob.cloudinaryUrl || selectedJob.filePreviewData} 
                              isCode 
                            />
                            {selectedJob.cloudinaryPublicId && (
                              <DetailRow label="Public ID" value={selectedJob.cloudinaryPublicId} isCode />
                            )}
                            {selectedJob.cloudinaryResourceType && (
                              <DetailRow label="Resource Type" value={selectedJob.cloudinaryResourceType} />
                            )}

                            {/* Main OTG Dispatch Button */}
                            <TouchableOpacity
                              style={[
                                styles.otgPrintMainBtn,
                                printingJobId === (selectedJob._id || selectedJob.jobId) && styles.otgPrintMainBtnActive
                              ]}
                              onPress={() => handlePrintJob(selectedJob)}
                              disabled={printingJobId === (selectedJob._id || selectedJob.jobId)}
                              activeOpacity={0.85}
                            >
                              {printingJobId === (selectedJob._id || selectedJob.jobId) ? (
                                <ActivityIndicator size="small" color="#000000" style={{ marginRight: 8 }} />
                              ) : (
                                <MaterialCommunityIcons name="printer-pos" size={20} color="#000000" style={{ marginRight: 8 }} />
                              )}
                              <Text style={styles.otgPrintMainBtnText}>
                                {printingJobId === (selectedJob._id || selectedJob.jobId) 
                                  ? (printStatusMessage || 'DISPATCHING TO OTG PRINTER...') 
                                  : '🖨️ SEND TO OTG / USB PRINTER'}
                              </Text>
                            </TouchableOpacity>

                            {/* Secondary Action Buttons */}
                            <View style={styles.modalActionButtonsRow}>
                              <TouchableOpacity
                                style={styles.modalSubActionBtn}
                                onPress={() => handleDownloadFile(selectedJob)}
                              >
                                <Ionicons name="download-outline" size={14} color="#ffffff" style={{ marginRight: 5 }} />
                                <Text style={styles.modalSubActionBtnText}>DOWNLOAD FILE</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={styles.modalSubActionBtn}
                                onPress={() => handleOpenUrl(selectedJob.cloudinaryUrl || selectedJob.filePreviewData)}
                              >
                                <Ionicons name="open-outline" size={14} color="#ffffff" style={{ marginRight: 5 }} />
                                <Text style={styles.modalSubActionBtnText}>OPEN CLOUD URL</Text>
                              </TouchableOpacity>
                            </View>

                            <View style={styles.otgHelpBox}>
                              <Ionicons name="information-circle-outline" size={14} color="#94a3b8" style={{ marginRight: 6, marginTop: 1 }} />
                              <Text style={styles.otgHelpText}>
                                Connect your printer via OTG Cable or USB. Tapping print will stream the document directly to the printer spooler.
                              </Text>
                            </View>
                          </>
                        ) : (
                          <View style={styles.noCloudinaryContainer}>
                            <Ionicons name="cloud-offline-outline" size={28} color="#71717a" style={{ marginBottom: 6 }} />
                            <Text style={styles.noCloudinaryText}>No Cloudinary URL found on this job record.</Text>
                            <Text style={styles.noCloudinarySubText}>Check if the kiosk uploaded the file successfully.</Text>
                          </View>
                        )}
                      </View>

                      {/* Document Overview Card */}
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionHeader}>DOCUMENT & FILE INFO</Text>
                        <DetailRow label="File Name" value={selectedJob.fileName} isCode />
                        <DetailRow label="File Type" value={selectedJob.fileType?.toUpperCase()} />
                        <DetailRow label="File Size" value={`${selectedJob.fileSizeMB || 0} MB`} />
                        <DetailRow label="PIN Token" value={selectedJob.pinToken || 'None'} highlight />
                        <DetailRow label="Kiosk Destination" value={selectedJob.kioskId} />
                      </View>

                      {/* Print Settings */}
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionHeader}>PRINT SPECIFICATIONS</Text>
                        <DetailRow label="Total Document Pages" value={String(selectedJob.totalPages || 1)} />
                        <DetailRow label="Page Selection Range" value={selectedJob.pageRange || '1-All'} />
                        <DetailRow label="Pages Count to Print" value={String(selectedJob.pagesToPrintCount || 1)} />
                        <DetailRow label="Number of Copies" value={String(selectedJob.copies || 1)} />
                        <DetailRow label="Paper Size" value={selectedJob.paperSize || 'A4'} />
                        <DetailRow label="Color Mode" value={selectedJob.isColor ? 'Full Color (CMYK)' : 'Black & White (Monochrome)'} />
                        <DetailRow label="Duplex / Sides" value={selectedJob.isDuplex ? 'Double Sided (Duplex)' : 'Single Sided'} />
                        <DetailRow label="Layout / N-Up" value={selectedJob.layoutMode || '1-Up'} />
                        <DetailRow label="Finishing" value={selectedJob.finishing || 'None'} />
                      </View>

                      {/* Financial & Transaction */}
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionHeader}>PAYMENT & TRANSACTION</Text>
                        <DetailRow label="Total Cost" value={`₹ ${selectedJob.totalCost || 0}.00`} highlight />
                        <DetailRow label="Payment Status" value={selectedJob.paymentStatus || 'PENDING'} />
                        <DetailRow label="Payment Method" value={selectedJob.paymentMethod || 'UPI'} />
                        <DetailRow label="Transaction ID" value={selectedJob.transactionId || 'N/A'} isCode />
                        <DetailRow label="Discount Amount" value={`₹ ${selectedJob.discountAmount || 0}`} />
                      </View>

                      {/* Timestamps */}
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionHeader}>AUDIT TIMESTAMPS</Text>
                        <DetailRow label="Created At" value={formatDate(selectedJob.createdAt)} />
                        <DetailRow label="Updated At" value={formatDate(selectedJob.updatedAt)} />
                      </View>

                      {/* Quick Status Changers */}
                      <View style={styles.statusChangeSection}>
                        <Text style={styles.detailSectionHeader}>UPDATE REAL-TIME STATUS</Text>
                        <View style={styles.statusButtonRow}>
                          {['PRINTING', 'COMPLETED', 'PENDING', 'FAILED'].map((st) => (
                            <TouchableOpacity
                              key={st}
                              style={[
                                styles.statusChangeBtn,
                                selectedJob.status === st && styles.statusChangeBtnActive
                              ]}
                              onPress={() => handleUpdateStatus(selectedJob._id, st)}
                            >
                              <Text style={[
                                styles.statusChangeBtnText,
                                selectedJob.status === st && styles.statusChangeBtnTextActive
                              ]}>
                                {st}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.jsonContainer}>
                      <Text style={styles.jsonText}>
                        {JSON.stringify(selectedJob, null, 2)}
                      </Text>
                    </View>
                  )}
                </ScrollView>

                {/* Modal Footer Actions */}
                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteJob(selectedJob._id)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                    <Text style={styles.deleteBtnText}>DELETE JOB</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.doneBtn}
                    onPress={() => setDetailModalVisible(false)}
                  >
                    <Text style={styles.doneBtnText}>CLOSE</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* --- ADD NEW TEST JOB MODAL --- */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>CREATE PRINT JOB</Text>
                <Text style={styles.modalSubtitle}>Insert new document directly into MongoDB Atlas</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setAddModalVisible(false)}>
                <Ionicons name="close" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Job ID</Text>
                <TextInput
                  style={styles.formInput}
                  value={newJobForm.jobId}
                  onChangeText={(t) => setNewJobForm({ ...newJobForm, jobId: t })}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>File Name</Text>
                <TextInput
                  style={styles.formInput}
                  value={newJobForm.fileName}
                  onChangeText={(t) => setNewJobForm({ ...newJobForm, fileName: t })}
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.formLabel}>Kiosk ID</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newJobForm.kioskId}
                    onChangeText={(t) => setNewJobForm({ ...newJobForm, kioskId: t })}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>PIN Token</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newJobForm.pinToken}
                    onChangeText={(t) => setNewJobForm({ ...newJobForm, pinToken: t })}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.formLabel}>Pages Count</Text>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="numeric"
                    value={String(newJobForm.pagesToPrintCount)}
                    onChangeText={(t) => setNewJobForm({ ...newJobForm, pagesToPrintCount: parseInt(t) || 1 })}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Total Cost (₹)</Text>
                  <TextInput
                    style={styles.formInput}
                    keyboardType="numeric"
                    value={String(newJobForm.totalCost)}
                    onChangeText={(t) => setNewJobForm({ ...newJobForm, totalCost: parseInt(t) || 0 })}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Initial Status</Text>
                <View style={styles.statusButtonRow}>
                  {['PRINTING', 'PENDING', 'COMPLETED'].map((st) => (
                    <TouchableOpacity
                      key={st}
                      style={[
                        styles.statusChangeBtn,
                        newJobForm.status === st && styles.statusChangeBtnActive
                      ]}
                      onPress={() => setNewJobForm({ ...newJobForm, status: st })}
                    >
                      <Text style={[
                        styles.statusChangeBtnText,
                        newJobForm.status === st && styles.statusChangeBtnTextActive
                      ]}>
                        {st}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.secondaryBtn} 
                onPress={() => setAddModalVisible(false)}
              >
                <Text style={styles.secondaryBtnText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.primaryBtn} 
                onPress={handleCreateTestJob}
              >
                <Text style={styles.primaryBtnText}>SAVE TO MONGODB</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- BACKEND SETTINGS MODAL --- */}
      <Modal
        visible={settingsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>BACKEND SETTINGS</Text>
                <Text style={styles.modalSubtitle}>Configure Live Server or Vercel Cloud API</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSettingsModalVisible(false)}>
                <Ionicons name="close" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Current API Base URL</Text>
                <TextInput
                  style={styles.formInput}
                  value={customApiInput}
                  onChangeText={setCustomApiInput}
                  placeholder="https://your-vercel-backend.vercel.app/api"
                  placeholderTextColor="#71717a"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionHeader}>QUICK PRESETS</Text>
                <TouchableOpacity 
                  style={[styles.kioskChip, { marginBottom: 8, paddingVertical: 8 }]}
                  onPress={() => setCustomApiInput('http://localhost:5000/api')}
                >
                  <Text style={styles.kioskChipText}>📍 Local Development: http://localhost:5000/api</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.kioskChip, { paddingVertical: 8 }]}
                  onPress={() => setCustomApiInput('https://ecopy-admin.vercel.app/api')}
                >
                  <Text style={styles.kioskChipText}>☁️ Vercel Cloud API Format: https://your-project.vercel.app/api</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.secondaryBtn} 
                onPress={() => setSettingsModalVisible(false)}
              >
                <Text style={styles.secondaryBtnText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.primaryBtn} 
                onPress={() => {
                  setApiBaseUrl(customApiInput.trim());
                  setSettingsModalVisible(false);
                  fetchData(true);
                }}
              >
                <Text style={styles.primaryBtnText}>SAVE & RECONNECT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Subcomponent for Key-Value display in Sheet
function DetailRow({ label, value, isCode, highlight }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailRowLabel}>{label}</Text>
      <Text style={[
        styles.detailRowValue,
        isCode && styles.codeFont,
        highlight && styles.highlightValue
      ]}>
        {value !== undefined && value !== null ? String(value) : '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#09090b',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0,
  },
  container: {
    flex: 1,
    backgroundColor: '#09090b',
    width: '100%',
  },
  contentContainer: {
    paddingHorizontal: 12,
    paddingBottom: 40,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },

  // Header Styles
  headerWrapper: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    backgroundColor: '#09090b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 7,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#3f3f46',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  dbStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 4,
  },
  headerSubtitle: {
    color: '#a1a1aa',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 6,
    marginRight: 5,
  },
  iconButtonActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  autoRefreshText: {
    color: '#a1a1aa',
    fontSize: 9,
    fontWeight: '800',
    marginLeft: 3,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
  },
  actionButtonText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '900',
    marginLeft: 2,
    letterSpacing: 0.5,
  },

  // Stats Grid
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
  },
  statCard: {
    width: '48.5%',
    backgroundColor: '#121215',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  statCardActive: {
    borderColor: '#52525b',
    backgroundColor: '#18181b',
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    color: '#71717a',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  statValue: {
    color: '#f4f4f5',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
  },
  liveBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveInnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },

  // Search & Filter
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121215',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
  },
  clearBtn: {
    padding: 4,
  },
  refreshIconBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // Filters
  filtersScroll: {
    flexDirection: 'row',
    marginVertical: 6,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121215',
    borderWidth: 1,
    borderColor: '#27272a',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  filterChipText: {
    color: '#a1a1aa',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  filterChipTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
    marginRight: 6,
  },

  // Kiosk Sub-Filter
  kioskFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  kioskFilterLabel: {
    color: '#52525b',
    fontSize: 10,
    fontWeight: '800',
    marginRight: 8,
    letterSpacing: 0.5,
  },
  kioskChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#18181b',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  kioskChipActive: {
    borderColor: '#a1a1aa',
    backgroundColor: '#27272a',
  },
  kioskChipText: {
    color: '#71717a',
    fontSize: 10,
    fontWeight: '700',
  },
  kioskChipTextActive: {
    color: '#ffffff',
  },

  // List Header
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 10,
  },
  listHeaderTitle: {
    color: '#a1a1aa',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortButtonText: {
    color: '#71717a',
    fontSize: 10,
    fontWeight: '700',
    marginRight: 4,
  },

  // Loading & Empty States
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#71717a',
    fontSize: 12,
    marginTop: 10,
  },
  emptyContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 14,
  },
  emptySubtitle: {
    color: '#71717a',
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 280,
    marginTop: 4,
  },
  createFirstBtn: {
    marginTop: 16,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 6,
  },
  createFirstBtnText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 11,
  },

  // Job Cards
  jobCard: {
    backgroundColor: '#121215',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 16,
    marginBottom: 12,
  },
  jobCardPrinting: {
    borderColor: '#52525b',
    backgroundColor: '#151518',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  idGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  jobIdBadge: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 6,
  },
  jobIdText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  pinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 6,
  },
  pinText: {
    color: '#d4d4d8',
    fontSize: 10,
    fontWeight: '700',
  },
  kioskBadge: {
    backgroundColor: '#18181b',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  kioskText: {
    color: '#71717a',
    fontSize: 10,
    fontWeight: '700',
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#27272a',
  },
  statusTagPrinting: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  statusTagCompleted: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  statusTagFailed: {
    backgroundColor: '#27272a',
  },
  statusTagText: {
    color: '#a1a1aa',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
    marginRight: 5,
  },

  // File Row inside Card
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    backgroundColor: '#18181b',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  fileIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  fileMeta: {
    color: '#71717a',
    fontSize: 11,
    fontWeight: '500',
  },

  // Specs Grid
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1f1f23',
    marginBottom: 12,
  },
  specItem: {
    width: '48%',
    marginBottom: 8,
  },
  specLabel: {
    color: '#52525b',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  specValue: {
    color: '#e4e4e7',
    fontSize: 12,
    fontWeight: '600',
  },
  costValue: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },

  // Card Action Bar (Quick OTG Print & Cloudinary Tag)
  cardActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f23',
  },
  cloudinaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    flexShrink: 1,
  },
  cloudinaryBadgeText: {
    color: '#38bdf8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardPrintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  cardPrintButtonActive: {
    backgroundColor: '#38bdf8',
  },
  cardPrintButtonText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // Global OTG Printing Notification Banner
  printNotificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#38bdf8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  printNotificationTitle: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  printNotificationText: {
    color: '#09090b',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },

  // Card Footer
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  timestampText: {
    color: '#71717a',
    fontSize: 11,
    fontWeight: '500',
  },
  paymentMethodTag: {
    color: '#52525b',
    fontSize: 10,
    marginLeft: 8,
    fontWeight: '600',
  },
  previewPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewPromptText: {
    color: '#a1a1aa',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginRight: 2,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#121215',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: '#27272a',
    height: '90%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginRight: 10,
  },
  modalSubtitle: {
    color: '#71717a',
    fontSize: 11,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  statusTagActiveModal: {
    backgroundColor: '#ffffff',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#18181b',
    borderRadius: 8,
    padding: 4,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: '#ffffff',
  },
  tabButtonText: {
    color: '#a1a1aa',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 6,
  },
  tabButtonTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  modalScroll: {
    flex: 1,
  },
  detailsContainer: {
    paddingVertical: 6,
  },

  // Cloudinary & OTG Hardware Dispatch Card
  cloudinarySection: {
    marginBottom: 20,
    backgroundColor: '#131317',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a32',
  },
  cloudinaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cloudinaryHeaderTitle: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  otgStatusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  otgStatusTagText: {
    color: '#4ade80',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  previewImageWrapper: {
    width: '100%',
    height: 180,
    backgroundColor: '#09090b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#27272a',
    marginVertical: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImageThumbnail: {
    width: '100%',
    height: '100%',
  },
  otgPrintMainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 14,
    marginBottom: 10,
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  otgPrintMainBtnActive: {
    backgroundColor: '#38bdf8',
  },
  otgPrintMainBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  modalActionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalSubActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e1e24',
    borderWidth: 1,
    borderColor: '#32323a',
    paddingVertical: 9,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  modalSubActionBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  otgHelpBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#18181f',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#262630',
  },
  otgHelpText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 14,
    flex: 1,
  },
  noCloudinaryContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noCloudinaryText: {
    color: '#a1a1aa',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  noCloudinarySubText: {
    color: '#52525b',
    fontSize: 10,
    fontWeight: '500',
  },

  detailSection: {
    marginBottom: 20,
    backgroundColor: '#18181b',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  detailSectionHeader: {
    color: '#a1a1aa',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#222226',
  },
  detailRowLabel: {
    color: '#71717a',
    fontSize: 12,
    fontWeight: '600',
  },
  detailRowValue: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    maxWidth: '60%',
    textAlign: 'right',
  },
  codeFont: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#d4d4d8',
  },
  highlightValue: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 13,
  },

  // Status Change Buttons inside Modal
  statusChangeSection: {
    marginBottom: 20,
    backgroundColor: '#18181b',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  statusButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  statusChangeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#121215',
    borderWidth: 1,
    borderColor: '#27272a',
    marginRight: 8,
    marginBottom: 6,
  },
  statusChangeBtnActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  statusChangeBtnText: {
    color: '#a1a1aa',
    fontSize: 10,
    fontWeight: '800',
  },
  statusChangeBtnTextActive: {
    color: '#000000',
  },

  // JSON Viewer
  jsonContainer: {
    backgroundColor: '#09090b',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  jsonText: {
    color: '#f4f4f5',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  // Modal Footer
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  deleteBtnText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 6,
  },
  doneBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 12,
  },

  // Form Styles in Add Modal
  formGroup: {
    marginBottom: 14,
  },
  formRow: {
    flexDirection: 'row',
  },
  formLabel: {
    color: '#a1a1aa',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    color: '#ffffff',
    fontSize: 13,
  },
  primaryBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryBtnText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 11,
  },
  secondaryBtn: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  secondaryBtnText: {
    color: '#a1a1aa',
    fontWeight: '700',
    fontSize: 11,
  },
});
