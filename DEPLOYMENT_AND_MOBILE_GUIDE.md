# 📱 E-Copy Admin App — Vercel Deployment & Android APK Installation Guide

इस गाइड में 2 मुख्य चीजें बताई गई हैं:
1. **Backend को Vercel पर Free Deploy करना** (ताकि कंप्यूटर बंद होने पर भी डेटाबेस कनेक्ट रहे)।
2. **React Native App का Standalone `.apk` बनाना और फोन में Install करना** (ताकि किसी भी Android फोन में बिना PC या VS Code के हमेशा ऐप चले)।

---

## 🚀 PART 1: Backend को Vercel पर Deploy करना (Serverless API)

हमने प्रोजेक्ट में `vercel.json` और `api/index.js` (Serverless handler with MongoDB connection pooling) पहले से सेट कर दिया है।

### Option A: Vercel CLI से Direct Deploy करना (सबसे आसान - 1 मिनट)

1. VS Code टर्मिनल में Vercel CLI install करें:
   ```bash
   npm install -g vercel
   ```
2. Deploy कमांड चलाएं:
   ```bash
   vercel
   ```
3. प्रॉम्प्ट्स पर `Y` दबाएं:
   - *Set up and deploy?* -> `Y`
   - *Which scope?* -> अपना अकाउंट चुनें
   - *Link to existing project?* -> `N`
   - *What's your project's name?* -> `ecopy-admin-backend`
   - *In which directory is your code located?* -> `./`
4. Deploy होते ही Vercel आपको लाइव URL देगा:
   ```
   https://ecopy-admin-backend.vercel.app
   ```
5. **MongoDB URI Environment Variable सेट करना**:
   Vercel Dashboard पर जाएं -> Project -> **Settings** -> **Environment Variables** -> Add:
   - Key: `MONGODB_URI`
   - Value: `mongodb+srv://copysupport01_db_user:PlSbN6jBaGZyUZ0m@cluster0.p02ss9y.mongodb.net/ecopy?retryWrites=true&w=majority`

---

## 📲 PART 2: Phone में App Download / Install करना (Standalone APK)

बिना VS Code या PC के किसी भी Android फोन में ऐप चलाने के लिए हम **EAS Cloud Build** का उपयोग करते हैं जो सीधे Downloadable `.apk` फाइल बना देता है।

### Step 1: EAS CLI Install करें
टर्मिनल में रन करें:
```bash
npm install -g eas-cli
```

### Step 2: Expo Account Login करें
```bash
eas login
```
*(यदि अकाउंट नहीं है तो [expo.dev](https://expo.dev) पर फ्री में 30 सेकंड में साइन अप करें)*

### Step 3: Android APK Build शुरू करें
`client` फोल्डर में जाकर APK build कमांड चलाएं:
```bash
cd client
eas build -p android --profile preview
```

- EAS Cloud खुद ब खुद पूरा Android APK बिल्ड कर देगा (आपके कंप्यूटर के CPU/RAM पर कोई लोड नहीं पड़ेगा)।
- Build पूरा होते ही टर्मिनल में और आपके Expo Dashboard पर **Direct APK Download Link और QR Code** मिल जाएगा।
- उस लिंक से APK को किसी भी फोन में डाउनलोड करके इंस्टॉल कर लें!

---

## ⚡ PART 3: App को Vercel Backend से Connect करना

जब आपका Backend Vercel पर लाइव हो जाए:
1. फोन में **ECopy Admin App** खोलें।
2. टॉप-राइट में **⚙️ Settings Icon** पर टैप करें।
3. अपना Vercel API URL डालें:
   ```
   https://your-project.vercel.app/api
   ```
4. **SAVE & RECONNECT** दबाएं।
5. अब आपका ऐप 24/7 दुनिया के किसी भी कोने से सीधे MongoDB Atlas से डेटा लोड और अपडेट करेगा!

---

## 💡 Quick Local Development Commands

- **Local Backend Start**: `npm run server` (Runs on `http://localhost:5000`)
- **Local React Native Web App**: `npm run client` (Runs on `http://localhost:8081`)
- **Local Mobile Expo Go QR**: `npm run client:mobile`
