import React from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';

const { width } = Dimensions.get('window');

const chartConfig = {
  backgroundGradientFrom: '#FFF',
  backgroundGradientTo: '#FFF',
  color: (opacity = 1) => `rgba(255, 69, 0, ${opacity})`,
  strokeWidth: 2,
  barPercentage: 0.5,
  useShadowColorFromDataset: false,
  decimalPlaces: 0,
};

export const LineChartComponent = ({ data, title, height = 220 }) => {
  if (!data || !data.labels || !data.datasets) {
    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>{title}</Text>
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>No data available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <LineChart
          data={data}
          width={Math.max(width - 40, data.labels.length * 50)}
          height={height}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
          withInnerLines={false}
          withOuterLines={true}
          withVerticalLabels={true}
          withHorizontalLabels={true}
          fromZero={true}
        />
      </ScrollView>
    </View>
  );
};

export const BarChartComponent = ({ data, title, height = 220 }) => {
  if (!data || !data.labels || !data.datasets) {
    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>{title}</Text>
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>No data available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <BarChart
          data={data}
          width={Math.max(width - 40, data.labels.length * 60)}
          height={height}
          chartConfig={chartConfig}
          style={styles.chart}
          withInnerLines={false}
          showBarTops={false}
          fromZero={true}
        />
      </ScrollView>
    </View>
  );
};

export const PieChartComponent = ({ data, title, height = 220 }) => {
  if (!data || data.length === 0) {
    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>{title}</Text>
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>No data available</Text>
        </View>
      </View>
    );
  }

  const colors = ['#FF4500', '#FF6A33', '#FF8566', '#FFA099', '#FFBBCC'];
  const pieData = data.map((item, index) => ({
    ...item,
    color: colors[index % colors.length],
    legendFontColor: '#666',
    legendFontSize: 14,
  }));

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>{title}</Text>
      <PieChart
        data={pieData}
        width={width - 40}
        height={height}
        chartConfig={chartConfig}
        accessor="population"
        backgroundColor="transparent"
        paddingLeft="15"
        center={[10, 50]}
        absolute
      />
    </View>
  );
};

export const MetricsCard = ({ title, value, subtitle, trend, trendDirection }) => {
  const getTrendColor = () => {
    if (trendDirection === 'up') return '#28A745';
    if (trendDirection === 'down') return '#DC3545';
    return '#666';
  };

  const getTrendIcon = () => {
    if (trendDirection === 'up') return '↗';
    if (trendDirection === 'down') return '↘';
    return '→';
  };

  return (
    <View style={styles.metricsCard}>
      <View style={styles.metricsHeader}>
        <Text style={styles.metricsTitle}>{title}</Text>
        {trend && (
          <View style={styles.trendContainer}>
            <Text style={[styles.trendIcon, { color: getTrendColor() }]}>
              {getTrendIcon()}
            </Text>
            <Text style={[styles.trendText, { color: getTrendColor() }]}>
              {trend}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.metricsValue}>{value}</Text>
      {subtitle && <Text style={styles.metricsSubtitle}>{subtitle}</Text>}
    </View>
  );
};

export const StatsDashboard = ({ stats, loading = false }) => {
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.noDataContainer}>
        <Text style={styles.noDataText}>No statistics available</Text>
      </View>
    );
  }

  return (
    <View style={styles.statsContainer}>
      <View style={styles.metricsRow}>
        <MetricsCard
          title="Total Issues"
          value={stats.summary?.totalComplaints || 0}
          subtitle="All time"
        />
        <MetricsCard
          title="Resolution Rate"
          value={stats.summary?.resolutionRate || '0%'}
          subtitle="Overall performance"
          trend={stats.summary?.resolutionTrend}
          trendDirection={stats.summary?.resolutionDirection}
        />
      </View>
      
      <View style={styles.metricsRow}>
        <MetricsCard
          title="Avg Response"
          value={`${stats.summary?.avgResponseTime || 0}h`}
          subtitle="Time to acknowledge"
        />
        <MetricsCard
          title="New Users"
          value={stats.summary?.newUsers || 0}
          subtitle="This month"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  chartContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  chart: {
    borderRadius: 8,
  },
  noDataContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  statsContainer: {
    padding: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  metricsCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  metricsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricsTitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trendIcon: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF4500',
    marginBottom: 4,
  },
  metricsSubtitle: {
    fontSize: 12,
    color: '#999',
  },
});