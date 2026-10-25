import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Catches render errors in a subtree so one broken screen shows a retry
// card instead of closing the whole app.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Screen crashed:', error, info?.componentStack);
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.container}>
        <Ionicons name="warning-outline" size={56} color="#FF4500" />
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>
          {this.props.message || 'This screen ran into a problem. Please try again.'}
        </Text>
        <TouchableOpacity style={styles.button} onPress={this.reset}>
          <Text style={styles.buttonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

// Wrap a screen component so each screen fails independently.
export function withErrorBoundary(Screen) {
  const Wrapped = (props) => (
    <ErrorBoundary>
      <Screen {...props} />
    </ErrorBoundary>
  );
  Wrapped.displayName = `WithErrorBoundary(${Screen.displayName || Screen.name || 'Screen'})`;
  return Wrapped;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#FFF' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#222', marginTop: 16 },
  message: { fontSize: 15, color: '#666', textAlign: 'center', marginTop: 8, lineHeight: 21 },
  button: { marginTop: 24, backgroundColor: '#FF4500', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
