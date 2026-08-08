import { SlakeSample } from '../src/types';

export const SLAKE_DATASET: SlakeSample[] = [
  // CHEST / LUNG X-RAYS & CTs
  {
    id: 'slake-001',
    question: 'Is there any abnormality visible in the lung area?',
    answer: 'Yes, subtle opacity and mild blunting of the left costophrenic angle consistent with early pleural effusion.',
    img_organ: 'Lung',
    content_type: 'Closed',
    modality: 'X-ray',
    plane: 'Coronal',
    keywords: ['lung', 'abnormality', 'opacity', 'pleural effusion', 'chest', 'x-ray'],
    sample_vector: [0.85, 0.12, 0.34, 0.92, 0.45]
  },
  {
    id: 'slake-002',
    question: 'Is this a chest X-ray?',
    answer: 'Yes, this is an anterior-posterior (AP) chest radiograph showing thoracic structures and lung fields.',
    img_organ: 'Chest',
    content_type: 'Closed',
    modality: 'X-ray',
    plane: 'Coronal',
    keywords: ['chest', 'x-ray', 'radiograph', 'thoracic', 'ap view'],
    sample_vector: [0.91, 0.08, 0.22, 0.88, 0.51]
  },
  {
    id: 'slake-003',
    question: 'What organ is shown in this medical image?',
    answer: 'The lungs, thoracic rib cage, cardiac silhouette, and mediastinum are visualized in this chest scan.',
    img_organ: 'Lung',
    content_type: 'Open',
    modality: 'X-ray',
    plane: 'Coronal',
    keywords: ['organ', 'lungs', 'cardiac', 'mediastinum', 'thoracic'],
    sample_vector: [0.82, 0.15, 0.30, 0.85, 0.49]
  },
  {
    id: 'slake-004',
    question: 'Is there pneumothorax present in the right lung?',
    answer: 'No pneumothorax or pleural air fluid level is observed in either hemithorax.',
    img_organ: 'Lung',
    content_type: 'Closed',
    modality: 'X-ray',
    plane: 'Coronal',
    keywords: ['pneumothorax', 'lung', 'pleural air', 'hemithorax', 'clear'],
    sample_vector: [0.78, 0.11, 0.29, 0.82, 0.44]
  },
  {
    id: 'slake-005',
    question: 'What type of scan is this?',
    answer: 'This is a high-resolution Computed Tomography (HRCT) scan of the chest.',
    img_organ: 'Lung',
    content_type: 'Open',
    modality: 'CT',
    plane: 'Axial',
    keywords: ['scan', 'type', 'ct', 'computed tomography', 'hrct'],
    sample_vector: [0.74, 0.22, 0.55, 0.79, 0.62]
  },

  // BRAIN MRIs
  {
    id: 'slake-010',
    question: 'What organ is shown in this medical image?',
    answer: 'The brain is depicted in a axial T2-weighted MRI view showing grey and white matter structure.',
    img_organ: 'Brain',
    content_type: 'Open',
    modality: 'MRI',
    plane: 'Axial',
    keywords: ['organ', 'brain', 'mri', 'axial', 'grey matter', 'neuro'],
    sample_vector: [0.15, 0.89, 0.78, 0.21, 0.83]
  },
  {
    id: 'slake-011',
    question: 'Is there any abnormality in the brain parenchyma?',
    answer: 'A well-circumscribed lesion with surrounding vasogenic edema is present in the left temporal cortex.',
    img_organ: 'Brain',
    content_type: 'Closed',
    modality: 'MRI',
    plane: 'Axial',
    keywords: ['abnormality', 'brain', 'lesion', 'edema', 'cortex', 'mri'],
    sample_vector: [0.18, 0.93, 0.82, 0.25, 0.88]
  },
  {
    id: 'slake-012',
    question: 'Are the brain ventricles enlarged?',
    answer: 'No ventricular dilation or midline shift is evident; lateral ventricles are normal in size.',
    img_organ: 'Brain',
    content_type: 'Closed',
    modality: 'MRI',
    plane: 'Axial',
    keywords: ['ventricles', 'brain', 'enlarged', 'midline shift', 'hydrocephalus'],
    sample_vector: [0.12, 0.85, 0.74, 0.19, 0.79]
  },
  {
    id: 'slake-013',
    question: 'Describe the visible findings in the temporal lobe.',
    answer: 'Increased T2/FLAIR hyperintensity in the medial temporal cortex with mild sulcal effacement.',
    img_organ: 'Brain',
    content_type: 'Open',
    modality: 'MRI',
    plane: 'Coronal',
    keywords: ['temporal lobe', 'flair', 'hyperintensity', 'sulcal effacement', 'brain'],
    sample_vector: [0.21, 0.91, 0.85, 0.23, 0.90]
  },

  // ABDOMINAL CT & ULTRASOUND
  {
    id: 'slake-020',
    question: 'What organ is shown in this medical image?',
    answer: 'The abdominal cavity highlighting the liver, gallbladder, and upper renal pole on CT scan.',
    img_organ: 'Liver',
    content_type: 'Open',
    modality: 'CT',
    plane: 'Axial',
    keywords: ['organ', 'liver', 'gallbladder', 'renal', 'abdomen', 'ct'],
    sample_vector: [0.42, 0.38, 0.92, 0.51, 0.35]
  },
  {
    id: 'slake-021',
    question: 'Is there any focal lesion in the liver parenchyma?',
    answer: 'A hypoattenuating nodular focal lesion is identified in segment VI of the liver, suspicious for hemangioma.',
    img_organ: 'Liver',
    content_type: 'Closed',
    modality: 'CT',
    plane: 'Axial',
    keywords: ['liver', 'focal lesion', 'hypoattenuating', 'segment vi', 'nodule', 'ct'],
    sample_vector: [0.45, 0.41, 0.95, 0.54, 0.39]
  },
  {
    id: 'slake-022',
    question: 'Are both kidneys visible and symmetrical?',
    answer: 'Yes, both left and right kidneys demonstrate normal cortical thickness and prompt nephrogram phase.',
    img_organ: 'Kidney',
    content_type: 'Closed',
    modality: 'CT',
    plane: 'Coronal',
    keywords: ['kidneys', 'symmetrical', 'renal cortex', 'nephrogram', 'abdomen'],
    sample_vector: [0.38, 0.33, 0.88, 0.48, 0.31]
  },

  // OOD / OUT-OF-DOMAIN GUARD EXAMPLES (E.g. Demographics, Medication)
  {
    id: 'slake-090',
    question: 'What is the patient\'s age?',
    answer: 'Information regarding patient age is out-of-domain (OOD) for image visual question answering as demographic records are stored in external EHR systems, not within the pixel metadata.',
    img_organ: 'N/A',
    content_type: 'OOD',
    modality: 'X-ray',
    keywords: ['age', 'patient', 'demographics', 'ehr', 'ood'],
    sample_vector: [0.01, 0.02, 0.03, 0.01, 0.02]
  },
  {
    id: 'slake-091',
    question: 'What medication is the patient taking?',
    answer: 'Pharmacological prescriptions cannot be inferred directly from visual radiology scans. Please consult the patient clinical chart or electronic pharmacy records.',
    img_organ: 'N/A',
    content_type: 'OOD',
    modality: 'MRI',
    keywords: ['medication', 'prescription', 'pharmacy', 'drugs', 'ood'],
    sample_vector: [0.02, 0.01, 0.02, 0.02, 0.01]
  }
];
