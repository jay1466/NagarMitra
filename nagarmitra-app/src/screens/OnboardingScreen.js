import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, Image, TouchableOpacity } from 'react-native';
import * as Animatable from 'react-native-animatable';
import { Ionicons } from '@expo/vector-icons';

const slides = [
  {
    key: '1',
    title: 'Welcome to NagarMitra\nनागरमित्र में आपका स्वागत है',
    subtitle: 'जन की आवाज, सरकार का समाधान',
    icon: (size,color) => <Ionicons name="ribbon" size={size} color={color} />,
  },
  {
    key: '2',
    title: 'Report Issues Easily\nसमस्याएँ आसानी से दर्ज करें',
    subtitle: 'Potholes, broken streetlights, garbage, water logging — Just snap, submit, done!\nगड्ढे, टूटी स्ट्रीट लाइट, कूड़ा, जलभराव — फोटो लें, सबमिट करें, हो गया!',
    icon: (size,color) => <Ionicons name="camera" size={size} color={color} />,
  },
  {
    key: '3',
    title: 'Track Updates\nअपडेट पर नज़र रखें',
    subtitle: 'Stay updated: Track status, get notified when work is in progress or resolved.\nस्थिति देखें, काम शुरू/समाप्त होने पर नोटिफिकेशन पाएं।',
    icon: (size,color) => <Ionicons name="notifications" size={size} color={color} />,
  },
  {
    key: '4',
    title: 'Ward-wise Transparency\nवार्ड-स्तर पारदर्शिता',
    subtitle: 'See issues reported in your locality and how they are being resolved.\nअपने वार्ड की समस्याएँ और उनका समाधान देखें।',
    icon: (size,color) => <Ionicons name="map" size={size} color={color} />,
  },
  {
    key: '5',
    title: 'Get Started\nशुरू करें',
    subtitle: 'Login/Sign Up to continue\nआगे बढ़ने के लिए लॉगिन/साइन अप करें',
    icon: (size,color) => <Ionicons name="arrow-forward-circle" size={size} color={color} />,
  },
];

const { width, height } = Dimensions.get('window');

// Typing animation component
const TypeWriter = ({ text, delay = 50, style }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    let timeouts = [];
    text.split('').forEach((char, i) => {
      timeouts.push(
        setTimeout(() => {
          setDisplayedText(text.substring(0, i + 1));
        }, delay * i)
      );
    });

    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [text, delay]);

  return <Text style={style}>{displayedText}</Text>;
};

export default function OnboardingScreen({ onDone }) {
  const listRef = useRef(null);
  const [index, setIndex] = useState(0);
  const [showTyping, setShowTyping] = useState(true);

  const renderItem = ({ item, index: slideIndex }) => {
    const isActive = slideIndex === index;
    const isFirstSlide = slideIndex === 0;
    
    return (
      <View style={styles.slide}>
        {/* Logo for first slide */}
        {isFirstSlide && (
          <Animatable.View
            animation="fadeInDown"
            delay={300}
            style={styles.logoContainer}
          >
            <View style={styles.logoPlaceholder}>
              <Image 
                source={require('../../assets/logo.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.logoText}>NagarMitra</Text>
            </View>
          </Animatable.View>
        )}
        
        {/* Icon for other slides */}
        {!isFirstSlide && (
          <Animatable.View
            animation={isActive ? "bounceIn" : "fadeIn"}
            delay={200}
            style={styles.iconContainer}
          >
            {item.icon(80, '#FF4500')}
          </Animatable.View>
        )}
        
        {/* Title with typing animation for first slide */}
        <Animatable.View
          animation={isActive ? "fadeInUp" : "fadeIn"}
          delay={isFirstSlide ? 1000 : 400}
          style={styles.textContainer}
        >
          {isFirstSlide && showTyping ? (
            <TypeWriter text={item.title} delay={100} style={styles.title} />
          ) : (
            <Text style={styles.title}>{item.title}</Text>
          )}
        </Animatable.View>
        
        {/* Subtitle */}
        <Animatable.View
          animation={isActive ? "fadeInUp" : "fadeIn"}
          delay={isFirstSlide ? 2000 : 600}
          style={styles.textContainer}
        >
          <Text style={[styles.subtitle, isFirstSlide && styles.tagline]}>
            {isFirstSlide ? `"${item.subtitle}"` : item.subtitle}
          </Text>
        </Animatable.View>
      </View>
    );
  };

  const next = () => {
    if (index < slides.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      onDone?.();
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        renderItem={renderItem}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          setIndex(i);
        }}
      />
      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <TouchableOpacity onPress={next} style={styles.button}>
          <Text style={styles.buttonText}>{index === slides.length - 1 ? 'Get Started' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff'
  },
  slide: { 
    width, 
    height: height * 0.85,
    padding: 24, 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 20
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#FFF5F0',
    borderRadius: 100,
    width: 140,
    height: 140,
    elevation: 5,
    shadowColor: '#FF4500',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  logoImage: {
    width: 100,
    height: 100,
  },
  logoText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF4500',
    marginTop: 5,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    padding: 20,
    backgroundColor: '#FFF5F0',
    borderRadius: 60,
    width: 120,
    height: 120,
    elevation: 3,
    shadowColor: '#FF4500',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: { 
    fontSize: 26, 
    fontWeight: '700', 
    textAlign: 'center',
    color: '#000',
    marginBottom: 10,
    lineHeight: 32,
  },
  subtitle: { 
    fontSize: 16, 
    color: '#444', 
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  tagline: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF4500',
    fontStyle: 'italic',
  },
  footer: { 
    position: 'absolute', 
    bottom: 50, 
    left: 0, 
    right: 0, 
    alignItems: 'center', 
    gap: 20
  },
  dots: { 
    flexDirection: 'row', 
    gap: 8
  },
  dot: { 
    width: 10, 
    height: 10, 
    borderRadius: 5, 
    backgroundColor: '#ddd'
  },
  dotActive: { 
    backgroundColor: '#FF4500',
    width: 24,
  },
  button: { 
    backgroundColor: '#FF4500', 
    paddingHorizontal: 32, 
    paddingVertical: 16, 
    borderRadius: 25,
    elevation: 3,
    shadowColor: '#FF4500',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    minWidth: 120,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
