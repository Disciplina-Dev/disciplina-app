import { PedaLevel } from '../types/mailTemplate.types';

/**
 * Modèles de relance d'absence livrés par défaut (un par niveau), semés au
 * premier démarrage. Les Pedas les modifient ensuite librement via l'UI.
 * Variables disponibles : {prenom}, {nom}, {mail} (variante {{…}} tolérée).
 */
export const PEDA_DEFAULT_TEMPLATES: {
    pedaLevel: PedaLevel;
    name: string;
    subject: string;
    body: string;
}[] = [
    {
        pedaLevel: 'niv1',
        name: 'Relance absence — niveau 1',
        subject: 'Absence constatée — {prenom} {nom}',
        body: [
            '<p>Bonjour {prenom},</p>',
            '<p>Nous avons constaté votre absence lors d’une séance de formation récente.</p>',
            '<p>Nous vous rappelons que l’assiduité fait partie intégrante de vos engagements ',
            'au titre de votre contrat d’apprentissage. Toute absence doit être justifiée ',
            'auprès du service pédagogique dans les plus brefs délais.</p>',
            '<p>Si vous rencontrez une difficulté particulière, n’hésitez pas à nous en faire part ',
            'afin que nous puissions vous accompagner.</p>',
            '<p>Cordialement,</p>',
        ].join(''),
    },
    {
        pedaLevel: 'niv2',
        name: 'Relance absence — niveau 2',
        subject: 'Absences répétées — {prenom} {nom}',
        body: [
            '<p>Bonjour {prenom},</p>',
            '<p>Malgré notre précédent rappel, de nouvelles absences ont été enregistrées à votre nom.</p>',
            '<p>Ces absences répétées nuisent à votre progression pédagogique et peuvent avoir ',
            'des conséquences sur la validation de votre formation ainsi que sur votre rémunération.</p>',
            '<p>Nous vous demandons de régulariser votre situation et de transmettre les justificatifs ',
            'manquants sans délai.</p>',
            '<p>Cordialement,</p>',
        ].join(''),
    },
    {
        pedaLevel: 'niv3',
        name: 'Relance absence — niveau 3',
        subject: 'Convocation — absences non justifiées — {prenom} {nom}',
        body: [
            '<p>Bonjour {prenom},</p>',
            '<p>Le nombre d’absences constatées à votre nom atteint un seuil préoccupant, ',
            'et plusieurs d’entre elles restent à ce jour non justifiées.</p>',
            '<p>Nous vous convions à un entretien avec le service pédagogique afin de faire le point ',
            'sur votre situation. Merci de nous contacter rapidement pour en fixer la date.</p>',
            '<p>Nous vous rappelons que votre employeur et votre OPCO sont informés de votre assiduité.</p>',
            '<p>Cordialement,</p>',
        ].join(''),
    },
    {
        pedaLevel: 'nivPlus',
        name: 'Relance absence — niveau +',
        subject: 'Mise en demeure — assiduité — {prenom} {nom}',
        body: [
            '<p>Bonjour {prenom},</p>',
            '<p>En dépit de nos relances successives et de nos tentatives d’accompagnement, ',
            'vos absences se poursuivent et demeurent en grande partie injustifiées.</p>',
            '<p>Cette situation constitue un manquement à vos obligations contractuelles. ',
            'Elle est portée à la connaissance de votre employeur et de votre OPCO, et peut ',
            'conduire à une suspension de rémunération ainsi qu’à la remise en cause de votre ',
            'inscription en formation.</p>',
            '<p>Nous vous demandons de prendre contact avec le service pédagogique sous 48 heures.</p>',
            '<p>Cordialement,</p>',
        ].join(''),
    },
];
