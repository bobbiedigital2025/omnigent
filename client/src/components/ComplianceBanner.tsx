import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export const CookieBanner: React.FC = () => {
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const cookieConsent = localStorage.getItem('cookie_consent');
    setAccepted(cookieConsent === 'accepted');
  }, []);

  if (accepted) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900 text-white p-4 shadow-lg border-t border-purple-500 z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm">
            We use cookies to enhance your experience. By continuing to browse, you agree to our{' '}
            <a href="/privacy" className="text-purple-400 hover:text-purple-300 underline">
              Privacy Policy
            </a>
            .
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              localStorage.setItem('cookie_consent', 'declined');
              setAccepted(true);
            }}
            className="px-4 py-2 text-sm text-gray-300 hover:text-white transition"
          >
            Decline
          </button>
          <button
            onClick={() => {
              localStorage.setItem('cookie_consent', 'accepted');
              setAccepted(true);
            }}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm font-medium transition"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};

export const PrivacyPolicyModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl max-h-96 overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-2xl font-bold">Privacy Policy</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>
        <div className="p-6 space-y-4 text-sm text-gray-700">
          <section>
            <h3 className="font-bold text-lg mb-2">1. Information We Collect</h3>
            <p>
              We collect information you provide directly, such as email, name, and account preferences.
              We also automatically collect usage data, IP addresses, and device information.
            </p>
          </section>
          <section>
            <h3 className="font-bold text-lg mb-2">2. How We Use Your Information</h3>
            <p>
              We use information to provide, maintain, and improve our services; send support communications;
              and ensure compliance with legal obligations.
            </p>
          </section>
          <section>
            <h3 className="font-bold text-lg mb-2">3. Data Protection</h3>
            <p>
              We implement industry-standard encryption and security measures. Data is only shared with
              trusted partners under strict confidentiality agreements.
            </p>
          </section>
          <section>
            <h3 className="font-bold text-lg mb-2">4. Your Rights</h3>
            <p>
              You have the right to access, modify, or delete your personal data. Contact us at privacy@example.com.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export const TermsOfServiceModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl max-h-96 overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-2xl font-bold">Terms of Service</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>
        <div className="p-6 space-y-4 text-sm text-gray-700">
          <section>
            <h3 className="font-bold text-lg mb-2">1. User Responsibilities</h3>
            <p>
              You agree to use this service only for lawful purposes and in a way that does not infringe upon
              the rights of others or restrict their use and enjoyment of the service.
            </p>
          </section>
          <section>
            <h3 className="font-bold text-lg mb-2">2. Licensing Terms</h3>
            <p>
              We grant you a limited, non-exclusive, non-transferable license to use our service. You may not
              reproduce, redistribute, or resell the service without explicit permission.
            </p>
          </section>
          <section>
            <h3 className="font-bold text-lg mb-2">3. Limitation of Liability</h3>
            <p>
              We provide the service "as is" without warranties. We are not liable for indirect, incidental,
              or consequential damages arising from your use of the service.
            </p>
          </section>
          <section>
            <h3 className="font-bold text-lg mb-2">4. Termination</h3>
            <p>
              We may terminate or suspend accounts that violate these terms or pose a security risk to our platform.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export const GDPRTools: React.FC = () => {
  const [showDownload, setShowDownload] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const handleDataExport = async () => {
    try {
      const response = await fetch('/api/gdpr/export', { method: 'POST' });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `personal-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      setShowDownload(false);
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  };

  const handleDataDeletion = async () => {
    if (confirm('Are you sure? This action cannot be undone.')) {
      try {
        await fetch('/api/gdpr/delete', { method: 'POST' });
        setShowDelete(false);
        alert('Your personal data has been deleted.');
      } catch (error) {
        console.error('Failed to delete data:', error);
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-bold mb-4">GDPR Data Rights</h3>
      <div className="space-y-4">
        <div>
          <h4 className="font-semibold mb-2">Data Access</h4>
          <p className="text-sm text-gray-600 mb-3">
            Download a copy of all your personal data in JSON format.
          </p>
          <button
            onClick={() => setShowDownload(!showDownload)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            {showDownload ? 'Cancel' : 'Export My Data'}
          </button>
          {showDownload && (
            <button
              onClick={handleDataExport}
              className="ml-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
            >
              Confirm Export
            </button>
          )}
        </div>

        <div className="border-t pt-4">
          <h4 className="font-semibold mb-2">Right to be Forgotten</h4>
          <p className="text-sm text-gray-600 mb-3">
            Request permanent deletion of your account and all associated data.
          </p>
          <button
            onClick={() => setShowDelete(!showDelete)}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
          >
            {showDelete ? 'Cancel' : 'Delete My Account'}
          </button>
          {showDelete && (
            <button
              onClick={handleDataDeletion}
              className="ml-2 px-4 py-2 bg-red-800 text-white rounded hover:bg-red-900 transition"
            >
              Confirm Deletion
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
