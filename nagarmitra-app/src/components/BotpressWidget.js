import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

const { width, height } = Dimensions.get('window');

const BOT_URL = "https://cdn.botpress.cloud/webchat/v3.6/shareable.html?configUrl=https://files.bpcontent.cloud/2026/03/20/18/20260320183704-118N1XOQ.json";

export default function BotpressWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View style={styles.container} pointerEvents="box-none">
      {isOpen ? (
        <View style={styles.chatWindow}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setIsOpen(false)} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
          <WebView 
            source={{ uri: BOT_URL }} 
            style={styles.webview} 
            startInLoadingState={true}
            bounces={false}
          />
        </View>
      ) : (
        <TouchableOpacity style={styles.fab} onPress={() => setIsOpen(true)}>
          <Ionicons name="chatbubbles" size={28} color="#FF9933" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 90 : 70, // above tab bar
    right: 20,
    width: width,
    height: height,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    pointerEvents: 'box-none',
    zIndex: 9999,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: '#FF9933', // Saffron
  },
  chatWindow: {
    width: width * 0.85 > 350 ? 350 : width * 0.85,
    height: height * 0.6 > 600 ? 600 : height * 0.6,
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    borderWidth: 2,
    borderColor: '#FF9933', // Saffron
  },
  header: {
    backgroundColor: '#FF9933', // Saffron
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  closeButton: {
    padding: 5,
  },
  webview: {
    flex: 1,
    backgroundColor: '#FFF',
  }
});
