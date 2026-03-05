ALTER TABLE controls ADD CONSTRAINT fk_controls_engagement
FOREIGN KEY (engagement_id) REFERENCES engagements(id);

ALTER TABLE tests ADD CONSTRAINT fk_tests_control
FOREIGN KEY (control_id) REFERENCES controls(id);