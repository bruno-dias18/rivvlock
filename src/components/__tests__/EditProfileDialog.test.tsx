import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { EditProfileDialog } from '../EditProfileDialog';

// Mock Supabase
const mockUpdate = vi.fn().mockResolvedValue({ error: null });
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      update: mockUpdate,
      eq: () => ({ error: null })
    })
  }
}));

// Mock Auth Context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-123', email: 'test@example.com' }
  })
}));

const mockProfile = {
  user_id: 'user-123',
  country: 'FR',
  user_type: 'company',
  first_name: 'Jean',
  last_name: 'Dupont',
  phone: '+33612345678',
  address: '123 rue Test',
  postal_code: '75001',
  city: 'Paris',
  company_name: 'Test Company',
  company_address: '456 rue Company',
  siret_uid: '12345678901234',
  is_subject_to_vat: true,
  vat_number: 'FR12345678901',
  tva_rate: 20,
  vat_rate: null
};

describe('EditProfileDialog', () => {
  const mockOnOpenChange = vi.fn();
  const mockOnProfileUpdated = vi.fn();
  const mockOnDeleteAccount = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockClear();
  });

  it('affiche le dialog quand open=true', () => {
    render(
      <EditProfileDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        profile={mockProfile}
        onProfileUpdated={mockOnProfileUpdated}
      />
    );

    expect(screen.getByText(/modifier le profil/i)).toBeInTheDocument();
  });

  it('pré-remplit les champs avec les données du profil', () => {
    render(
      <EditProfileDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        profile={mockProfile}
        onProfileUpdated={mockOnProfileUpdated}
      />
    );

    expect(screen.getByDisplayValue('Jean')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Dupont')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Company')).toBeInTheDocument();
  });

  it('affiche les sections appropriées pour une entreprise', () => {
    render(
      <EditProfileDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        profile={mockProfile}
        onProfileUpdated={mockOnProfileUpdated}
      />
    );

    expect(screen.getByText(/informations personnelles/i)).toBeInTheDocument();
    expect(screen.getByText(/informations entreprise/i)).toBeInTheDocument();
    expect(screen.getByText(/informations fiscales/i)).toBeInTheDocument();
  });

  it('affiche le champ SIRET pour la France', () => {
    render(
      <EditProfileDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        profile={mockProfile}
        onProfileUpdated={mockOnProfileUpdated}
      />
    );

    expect(screen.getByLabelText(/numéro siret/i)).toBeInTheDocument();
  });

  it('affiche le champ UID pour la Suisse', () => {
    const swissProfile = { ...mockProfile, country: 'CH' };
    render(
      <EditProfileDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        profile={swissProfile}
        onProfileUpdated={mockOnProfileUpdated}
      />
    );

    expect(screen.getByLabelText(/numéro uid/i)).toBeInTheDocument();
  });

  it('affiche les champs TVA si assujetti', () => {
    render(
      <EditProfileDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        profile={mockProfile}
        onProfileUpdated={mockOnProfileUpdated}
      />
    );

    expect(screen.getByLabelText(/numéro de tva/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/taux de tva/i)).toBeInTheDocument();
  });

  it('masque les champs TVA si non assujetti', async () => {
    const user = userEvent.setup();
    const nonVatProfile = { ...mockProfile, is_subject_to_vat: false };
    render(
      <EditProfileDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        profile={nonVatProfile}
        onProfileUpdated={mockOnProfileUpdated}
      />
    );

    expect(screen.queryByLabelText(/numéro de tva/i)).not.toBeInTheDocument();
  });

  it('permet de modifier les informations', async () => {
    const user = userEvent.setup();
    render(
      <EditProfileDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        profile={mockProfile}
        onProfileUpdated={mockOnProfileUpdated}
      />
    );

    const firstNameInput = screen.getByDisplayValue('Jean');
    await user.clear(firstNameInput);
    await user.type(firstNameInput, 'Pierre');

    const saveButton = screen.getByRole('button', { name: /enregistrer/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockOnProfileUpdated).toHaveBeenCalled();
    });
  });

  it('affiche une erreur si le SIRET est invalide', async () => {
    const user = userEvent.setup();
    render(
      <EditProfileDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        profile={mockProfile}
        onProfileUpdated={mockOnProfileUpdated}
      />
    );

    const siretInput = screen.getByDisplayValue('12345678901234');
    await user.clear(siretInput);
    await user.type(siretInput, '123');

    const saveButton = screen.getByRole('button', { name: /enregistrer/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/le numéro siret doit contenir exactement 14 chiffres/i)).toBeInTheDocument();
    });
  });

  it('affiche une erreur si le numéro de TVA est invalide', async () => {
    const user = userEvent.setup();
    render(
      <EditProfileDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        profile={mockProfile}
        onProfileUpdated={mockOnProfileUpdated}
      />
    );

    const vatInput = screen.getByDisplayValue('FR12345678901');
    await user.clear(vatInput);
    await user.type(vatInput, 'INVALID');

    const saveButton = screen.getByRole('button', { name: /enregistrer/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/le numéro de tva/i)).toBeInTheDocument();
    });
  });

  it('ferme le dialog au clic sur Annuler', async () => {
    const user = userEvent.setup();
    render(
      <EditProfileDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        profile={mockProfile}
        onProfileUpdated={mockOnProfileUpdated}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /annuler/i });
    await user.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('affiche le bouton de suppression de compte', () => {
    render(
      <EditProfileDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        profile={mockProfile}
        onProfileUpdated={mockOnProfileUpdated}
        onDeleteAccount={mockOnDeleteAccount}
      />
    );

    expect(screen.getByRole('button', { name: /supprimer mon compte/i })).toBeInTheDocument();
  });

  it('affiche les taux de TVA français pour la France', () => {
    render(
      <EditProfileDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        profile={mockProfile}
        onProfileUpdated={mockOnProfileUpdated}
      />
    );

    const vatRateSelect = screen.getByLabelText(/taux de tva/i);
    expect(vatRateSelect).toBeInTheDocument();
  });

  it('affiche les taux de TVA suisses pour la Suisse', () => {
    const swissProfile = { ...mockProfile, country: 'CH', tva_rate: null, vat_rate: 8.1 };
    render(
      <EditProfileDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        profile={swissProfile}
        onProfileUpdated={mockOnProfileUpdated}
      />
    );

    const vatRateSelect = screen.getByLabelText(/taux de tva/i);
    expect(vatRateSelect).toBeInTheDocument();
  });
});
