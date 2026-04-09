import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError('');
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await register(email, password, firstName || undefined, lastName || undefined, phone || undefined);
      router.replace('/auth/login');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'error' in err
        ? (err as { error?: { message?: string } }).error?.message ?? 'Registration failed'
        : 'Registration failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.form}>
          <Text style={styles.title}>Create Account</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Input label="First Name" value={firstName} onChangeText={setFirstName} placeholder="John" />
          <Input label="Last Name" value={lastName} onChangeText={setLastName} placeholder="Doe" />
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />
          <Input label="Phone" value={phone} onChangeText={setPhone} placeholder="801-555-0123" />
          <Button title={loading ? 'Creating...' : 'Create Account'} onPress={handleRegister} disabled={loading} />
          <TouchableOpacity onPress={() => router.back()} style={styles.link}>
            <Text style={styles.linkText}>Already have an account? Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  form: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 24,
  },
  error: {
    color: '#dc2626',
    marginBottom: 16,
  },
  link: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    color: '#1B4D7A',
  },
});
