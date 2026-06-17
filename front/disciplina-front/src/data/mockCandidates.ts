import {
  TitleProfessionalType,
  CandidateStatus,
  SchoolLevel,
  TrainingSite,
} from '@/types/candidate';
import type { Candidate } from '@/types/candidate';

export const mockCandidates: Candidate[] = [
  {
    _id: "cand-001",
    tp_type: TitleProfessionalType.CC,
    status: CandidateStatus.SEEKING,
    training_site: TrainingSite.NORD_SAINTE_MARIE,
    identity: {
      full_name: "Léa Payet",
      age: 22,
      email: "lea.payet@example.com",
      phone: "0692 12 34 56",
      driving_license_b: true,
      city: "Saint-Denis",
      avatar_url: "https://i.pravatar.cc/150?img=1"
    },
    education: {
      school_level: SchoolLevel.BAC,
    },
    background: {
      last_diploma: "Baccalauréat STMG",
    },
    profile: {
      french_level: 4,
      english_level: 3,
    }
  },
  {
    _id: "cand-002",
    tp_type: TitleProfessionalType.NTC,
    status: CandidateStatus.MATCHED,
    training_site: TrainingSite.SUD_SAINT_PIERRE,
    identity: {
      full_name: "Lucas Hoarau",
      age: 25,
      email: "lucas.hoarau@example.com",
      phone: "0693 98 76 54",
      driving_license_b: false,
      city: "Saint-Pierre",
      avatar_url: "https://i.pravatar.cc/150?img=11"
    },
    education: {
      school_level: SchoolLevel.BAC_PLUS_2,
    },
    background: {
      last_diploma: "BTS MCO",
    },
    profile: {
      french_level: 5,
      english_level: 4,
    }
  },
  {
    _id: "cand-003",
    tp_type: TitleProfessionalType.AD,
    status: CandidateStatus.NOT_SEEKING,
    training_site: TrainingSite.OUEST_SAINT_PAUL,
    identity: {
      full_name: "Chloé Grondin",
      age: 28,
      email: "chloe.grondin@example.com",
      phone: "0692 11 22 33",
      driving_license_b: true,
      city: "Saint-Paul",
      avatar_url: "https://i.pravatar.cc/150?img=5"
    },
    education: {
      school_level: SchoolLevel.BAC_PLUS_3_PLUS,
    },
    background: {
      last_diploma: "Licence Pro RH",
    },
    profile: {
      french_level: 5,
      english_level: 5,
    }
  },
  {
    _id: "cand-004",
    tp_type: TitleProfessionalType.REM,
    status: CandidateStatus.CONTRACT,
    training_site: TrainingSite.NORD_SAINTE_MARIE,
    identity: {
      full_name: "Mathéo Lebon",
      age: 21,
      email: "matheo.lebon@example.com",
      phone: "0692 44 55 66",
      driving_license_b: true,
      city: "Sainte-Marie",
      avatar_url: "https://i.pravatar.cc/150?img=12"
    },
    education: {
      school_level: SchoolLevel.BAC,
    },
    background: {
      last_diploma: "Bac Pro Vente",
    },
    profile: {
      french_level: 3,
      english_level: 2,
    }
  },
  {
    _id: "cand-005",
    tp_type: TitleProfessionalType.SA,
    status: CandidateStatus.CANCELLED,
    training_site: TrainingSite.SUD_SAINT_PIERRE,
    identity: {
      full_name: "Emma Rivière",
      age: 24,
      email: "emma.riviere@example.com",
      phone: "0693 77 88 99",
      driving_license_b: false,
      city: "Le Tampon",
      avatar_url: "https://i.pravatar.cc/150?img=9"
    },
    education: {
      school_level: SchoolLevel.BAC_PLUS,
    },
    background: {
      last_diploma: "BTS Assistant de Manager",
    },
    profile: {
      french_level: 4,
      english_level: 3,
    }
  },
  {
    _id: "cand-006",
    tp_type: TitleProfessionalType.CC,
    status: CandidateStatus.BANNED,
    training_site: TrainingSite.OUEST_SAINT_PAUL,
    identity: {
      full_name: "Noah Fontaine",
      age: 30,
      email: "noah.fontaine@example.com",
      phone: "0692 33 22 11",
      driving_license_b: true,
      city: "Le Port",
      avatar_url: "https://i.pravatar.cc/150?img=15"
    },
    education: {
      school_level: SchoolLevel.PREMIERE_TERMINALE_WITH_1Y_EXP,
    },
    background: {
      last_diploma: "Niveau Bac",
    },
    profile: {
      french_level: 3,
      english_level: 2,
    }
  },
  {
    _id: "cand-007",
    tp_type: TitleProfessionalType.NTC,
    status: CandidateStatus.SEEKING,
    training_site: TrainingSite.NORD_SAINTE_MARIE,
    identity: {
      full_name: "Jade Boyer",
      age: 19,
      email: "jade.boyer@example.com",
      phone: "0693 55 44 33",
      driving_license_b: false,
      city: "Saint-Denis",
      avatar_url: "https://i.pravatar.cc/150?img=16"
    },
    education: {
      school_level: SchoolLevel.BAC,
    },
    background: {
      last_diploma: "Bac Général",
    },
    profile: {
      french_level: 4,
      english_level: 4,
    }
  },
  {
    _id: "cand-008",
    tp_type: TitleProfessionalType.AD,
    status: CandidateStatus.MATCHED,
    training_site: TrainingSite.SUD_SAINT_PIERRE,
    identity: {
      full_name: "Hugo Maillot",
      age: 26,
      email: "hugo.maillot@example.com",
      phone: "0692 88 77 66",
      driving_license_b: true,
      city: "Saint-Joseph",
      avatar_url: "https://i.pravatar.cc/150?img=18"
    },
    education: {
      school_level: SchoolLevel.BAC_PLUS_2_PLUS,
    },
    background: {
      last_diploma: "Master 1 Management",
    },
    profile: {
      french_level: 5,
      english_level: 3,
    }
  },
  {
    _id: "cand-009",
    tp_type: TitleProfessionalType.CC,
    status: CandidateStatus.SEEKING,
    training_site: TrainingSite.OUEST_SAINT_PAUL,
    identity: {
      full_name: "Inès Técher",
      age: 20,
      email: "ines.techer@example.com",
      phone: "0693 11 99 88",
      driving_license_b: true,
      city: "Saint-Leu",
      avatar_url: "https://i.pravatar.cc/150?img=20"
    },
    education: {
      school_level: SchoolLevel.BAC_PLUS,
    },
    background: {
      last_diploma: "Bac Pro Commerce",
    },
    profile: {
      french_level: 4,
      english_level: 2,
    }
  },
  {
    _id: "cand-010",
    tp_type: TitleProfessionalType.REM,
    status: CandidateStatus.CONTRACT,
    training_site: TrainingSite.NORD_SAINTE_MARIE,
    identity: {
      full_name: "Arthur Morel",
      age: 27,
      email: "arthur.morel@example.com",
      phone: "0692 55 66 77",
      driving_license_b: true,
      city: "Sainte-Suzanne",
      avatar_url: "https://i.pravatar.cc/150?img=33"
    },
    education: {
      school_level: SchoolLevel.BAC_PLUS_2,
    },
    background: {
      last_diploma: "DUT Techniques de Commercialisation",
    },
    profile: {
      french_level: 5,
      english_level: 4,
    }
  },
  {
    _id: "cand-011",
    tp_type: TitleProfessionalType.AD,
    status: CandidateStatus.SEEKING,
    training_site: TrainingSite.NORD_SAINTE_MARIE,
    identity: {
      full_name: "Mélissa Hoarau",
      age: 23,
      email: "melissa.hoarau@example.com",
      phone: "0692 34 56 78",
      driving_license_b: true,
      city: "Sainte-Marie",
      avatar_url: "https://i.pravatar.cc/150?img=41"
    },
    education: {
      school_level: SchoolLevel.BAC_PLUS_2,
    },
    background: {
      last_diploma: "BTS Assistant Manager",
    },
    profile: {
      french_level: 4,
      english_level: 3,
    }
  },
  {
    _id: "cand-012",
    tp_type: TitleProfessionalType.NTC,
    status: CandidateStatus.MATCHED,
    training_site: TrainingSite.SUD_SAINT_PIERRE,
    identity: {
      full_name: "Antoine Dijoux",
      age: 29,
      email: "antoine.dijoux@example.com",
      phone: "0693 45 67 89",
      driving_license_b: false,
      city: "Saint-Louis",
      avatar_url: "https://i.pravatar.cc/150?img=50"
    },
    education: {
      school_level: SchoolLevel.BAC_PLUS_3_PLUS,
    },
    background: {
      last_diploma: "Licence Commerce",
    },
    profile: {
      french_level: 5,
      english_level: 4,
    }
  },
  {
    _id: "cand-013",
    tp_type: TitleProfessionalType.CC,
    status: CandidateStatus.CONTRACT,
    training_site: TrainingSite.OUEST_SAINT_PAUL,
    identity: {
      full_name: "Sarah Ethève",
      age: 21,
      email: "sarah.etheve@example.com",
      phone: "0692 56 78 90",
      driving_license_b: true,
      city: "La Possession",
      avatar_url: "https://i.pravatar.cc/150?img=47"
    },
    education: {
      school_level: SchoolLevel.BAC,
    },
    background: {
      last_diploma: "Bac STMG",
    },
    profile: {
      french_level: 4,
      english_level: 2,
    }
  },
  {
    _id: "cand-014",
    tp_type: TitleProfessionalType.SA,
    status: CandidateStatus.SEEKING,
    training_site: TrainingSite.SUD_SAINT_PIERRE,
    identity: {
      full_name: "Thomas Lebreton",
      age: 18,
      email: "thomas.lebreton@example.com",
      phone: "0693 67 89 01",
      driving_license_b: false,
      city: "Le Tampon",
      avatar_url: "https://i.pravatar.cc/150?img=60"
    },
    education: {
      school_level: SchoolLevel.PREMIERE_TERMINALE,
    },
    background: {
      last_diploma: "Brevet des collèges",
    },
    profile: {
      french_level: 3,
      english_level: 2,
    }
  },
  {
    _id: "cand-015",
    tp_type: TitleProfessionalType.REM,
    status: CandidateStatus.NOT_SEEKING,
    training_site: TrainingSite.NORD_SAINTE_MARIE,
    identity: {
      full_name: "Julie Bègue",
      age: 26,
      email: "julie.begue@example.com",
      phone: "0692 78 90 12",
      driving_license_b: true,
      city: "Saint-Denis",
      avatar_url: "https://i.pravatar.cc/150?img=65"
    },
    education: {
      school_level: SchoolLevel.BAC_PLUS_2,
    },
    background: {
      last_diploma: "BTS MUC",
    },
    profile: {
      french_level: 5,
      english_level: 3,
    }
  }
];
