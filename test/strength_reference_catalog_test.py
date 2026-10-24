"""Catalog rebuilds must preserve clinic IDs and fail closed on stale mappings."""
import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from strength_reference_catalog import merge_references


class ReferenceCatalogTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = json.loads((ROOT / 'practice-strength-catalog.json').read_text())

    def test_rebuild_is_repeatable_and_does_not_mutate_input(self):
        before = copy.deepcopy(self.catalog)
        result = merge_references(self.catalog)
        self.assertEqual(result, before)
        self.assertEqual(self.catalog, before)

    def test_official_refresh_cannot_silently_drop_a_reference(self):
        source = copy.deepcopy(self.catalog)
        manifest = json.loads((ROOT / 'tools/strength-reference-names.json').read_text())
        mapped = next(t for r in manifest['coverage'] for t in r['targets'] if t.startswith('mfds-'))
        source['ingredients'] = [x for x in source['ingredients'] if x['id'] != mapped]
        with self.assertRaisesRegex(ValueError, 'Recheck reference mapping'):
            merge_references(source)

    def test_original_base_rebuild_restores_all_reviewed_names(self):
        source = copy.deepcopy(self.catalog)
        source['ingredients'] = [x for x in source['ingredients'] if x['id'].startswith('mfds-')]
        for x in source['ingredients']:
            x.pop('referenceNames', None)
        result = merge_references(source)
        self.assertEqual(result, self.catalog)


if __name__ == '__main__':
    unittest.main()
